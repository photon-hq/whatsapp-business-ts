import { fromGrpcError } from "../errors/error-handler.ts";
import { ConnectionError, WhatsAppError } from "../errors/whatsapp-error.ts";
import type { SubscribeEventsResponse } from "../generated/photon/whatsapp/v1/message_service.ts";
import { TypedEventStream } from "../streaming/event-stream.ts";
import { withResumableReconnect } from "../streaming/reconnect.ts";
import type { MessageServiceClient } from "../transport/grpc-client.ts";
import { mapEvent, mapMissedEvent } from "../transport/mapper.ts";
import type {
  FetchMissedOptions,
  FetchMissedResult,
  SubscribeOptions,
} from "../types/common.ts";
import { ErrorCode } from "../types/errors.ts";
import type { WhatsAppEvent } from "../types/events.ts";

/**
 * Default for {@link SubscribeOptions.stallTimeoutMs}: four missed server
 * heartbeats (30s cadence). Generous enough to ride out GC pauses and slow
 * links, short enough that a half-open stream recovers in ~2 minutes
 * instead of never.
 */
export const DEFAULT_STALL_TIMEOUT_MS = 120_000;

/** Mirrors gRPC DEADLINE_EXCEEDED — the closest status to a stalled stream. */
const GRPC_DEADLINE_EXCEEDED = 4;

const stallError = (timeoutMs: number): ConnectionError =>
  new ConnectionError(
    `Live event stream received no frames (not even heartbeats) for ${timeoutMs}ms — connection presumed half-open; reconnecting`,
    {
      code: ErrorCode.timeout,
      context: { stallTimeoutMs: String(timeoutMs) },
      grpcCode: GRPC_DEADLINE_EXCEEDED,
      retryable: true,
    }
  );

/**
 * Await the iterator's next frame, but give up after `timeoutMs`.
 *
 * On timeout the pending `next()` is abandoned; a frame that resolves into
 * it afterwards is dropped. That is safe ONLY because the caller tears the
 * stream down and reconnects through the cursor gap-fill path, which
 * replays anything missed — do not reuse this helper anywhere without that
 * guarantee (same class of race as the server-side event-loss fix in
 * spectrum-whatsapp-business commit 44cf851).
 */
const nextOrStall = async <T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number
): Promise<IteratorResult<T>> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<IteratorResult<T>>((resolve, reject) => {
      timer = setTimeout(() => reject(stallError(timeoutMs)), timeoutMs);
      iterator.next().then(resolve, reject);
    });
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

export class EventsResource {
  private readonly _client: MessageServiceClient;

  constructor(client: MessageServiceClient) {
    this._client = client;
  }

  subscribe(options?: SubscribeOptions): TypedEventStream<WhatsAppEvent> {
    let lastCursor = options?.cursor;
    const stallTimeoutMs = options?.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS;

    const stream = withResumableReconnect<WhatsAppEvent>(
      () =>
        this._mapStream(
          this._client.subscribeEvents({}),
          (c) => {
            lastCursor = c;
          },
          options?.onActivity,
          stallTimeoutMs
        ),
      async (cursor) => {
        try {
          const response = await this._client.fetchMissedEvents({
            cursor: { value: cursor },
          });
          const missed = response.events
            .map(mapMissedEvent)
            .filter((e): e is WhatsAppEvent => e !== null);
          // Advance the resume cursor past what the gap-fill replayed —
          // otherwise a connect failure right after a gap-fill re-fetches
          // (and re-delivers) the same events on the next attempt.
          const latest = missed.at(-1)?.cursor;
          if (latest) {
            lastCursor = latest;
          }
          return missed;
        } catch (err) {
          throw fromGrpcError(err);
        }
      },
      () => lastCursor,
      options?.reconnect
    );

    return new TypedEventStream(stream);
  }

  async fetchMissed(options: FetchMissedOptions): Promise<FetchMissedResult> {
    try {
      const response = await this._client.fetchMissedEvents({
        cursor: { value: options.cursor },
        limit: options.limit,
      });

      return {
        events: response.events
          .map(mapMissedEvent)
          .filter((e): e is WhatsAppEvent => e !== null),
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  private async *_mapStream(
    rpcStream: AsyncIterable<SubscribeEventsResponse>,
    onCursor: (cursor: string) => void,
    onActivity?: () => void,
    stallTimeoutMs?: number
  ): AsyncGenerator<WhatsAppEvent> {
    const iterator = rpcStream[Symbol.asyncIterator]();
    try {
      for (;;) {
        // The stall timer spans only the wait for the SERVER's next frame —
        // it is never armed while a slow consumer holds the yield below, so
        // backpressure cannot false-trigger a reconnect.
        const result =
          stallTimeoutMs && stallTimeoutMs > 0
            ? await nextOrStall(iterator, stallTimeoutMs)
            : await iterator.next();
        if (result.done) {
          return;
        }
        const proto = result.value;
        // Fire for EVERY frame, before mapping: the frames mapEvent discards
        // (heartbeats, cursor-only) are exactly the liveness signal an idle
        // stream has, and a mapper gap must not hide server activity.
        onActivity?.();
        if (proto.cursor) {
          onCursor(proto.cursor.value);
        }
        const event = mapEvent(proto);
        if (event) {
          yield event;
        }
      }
    } catch (err) {
      throw err instanceof WhatsAppError ? err : fromGrpcError(err);
    } finally {
      // Cancel the underlying gRPC call. Fire-and-forget: on a half-open
      // connection return() may only settle at transport timeout, and
      // reconnection must not wait for a dead socket's teardown.
      Promise.resolve(iterator.return?.(undefined)).catch(() => undefined);
    }
  }
}
