/**
 * Auto-reconnecting wrappers for async iterable streams.
 *
 * {@link withReconnect} is the basic version that re-invokes the stream
 * factory after a disconnect with exponential backoff.
 *
 * {@link withResumableReconnect} extends this with cursor-based gap-fill:
 * on reconnect it fetches missed events before resuming the live stream.
 */

import type { ReconnectOptions } from "../types/common.ts";

// ---------------------------------------------------------------------------
// Basic reconnect
// ---------------------------------------------------------------------------

export function withReconnect<T>(
  createStream: () => AsyncIterable<T>,
  options?: ReconnectOptions,
): AsyncIterable<T> {
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30_000;
  const multiplier = options?.multiplier ?? 2;
  const maxAttempts = options?.maxAttempts ?? Number.POSITIVE_INFINITY;
  const onReconnect = options?.onReconnect;

  async function* reconnecting(): AsyncGenerator<T> {
    let consecutiveFailures = 0;
    let delay = initialDelay;

    for (;;) {
      try {
        const stream = createStream();
        let receivedAtLeastOne = false;

        for await (const event of stream) {
          if (!receivedAtLeastOne) {
            receivedAtLeastOne = true;
            consecutiveFailures = 0;
            delay = initialDelay;
          }
          yield event;
        }
      } catch {
        // Stream errored — fall through to reconnect logic.
      }

      consecutiveFailures++;

      if (consecutiveFailures > maxAttempts) {
        return;
      }

      onReconnect?.(consecutiveFailures);

      await sleep(delay);
      delay = Math.min(delay * multiplier, maxDelay);
    }
  }

  return reconnecting();
}

// ---------------------------------------------------------------------------
// Resumable reconnect (with cursor-based gap-fill)
// ---------------------------------------------------------------------------

export function withResumableReconnect<T>(
  createStream: () => AsyncIterable<T>,
  fetchMissed: (cursor: string) => Promise<T[]>,
  getCursor: () => string | undefined,
  options?: ReconnectOptions,
): AsyncIterable<T> {
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30_000;
  const multiplier = options?.multiplier ?? 2;
  const maxAttempts = options?.maxAttempts ?? Number.POSITIVE_INFINITY;
  const onReconnect = options?.onReconnect;

  async function* reconnecting(): AsyncGenerator<T> {
    let consecutiveFailures = 0;
    let delay = initialDelay;
    let isFirstConnect = true;

    for (;;) {
      try {
        // On reconnect (not first connect), fetch missed events.
        if (!isFirstConnect) {
          const cursor = getCursor();
          if (cursor) {
            try {
              const missed = await fetchMissed(cursor);
              for (const event of missed) {
                yield event;
              }
            } catch {
              // Gap-fill failed — continue with live stream anyway.
            }
          }
        }

        isFirstConnect = false;
        const stream = createStream();
        let receivedAtLeastOne = false;

        for await (const event of stream) {
          if (!receivedAtLeastOne) {
            receivedAtLeastOne = true;
            consecutiveFailures = 0;
            delay = initialDelay;
          }
          yield event;
        }
      } catch {
        // Stream errored — fall through to reconnect logic.
      }

      consecutiveFailures++;

      if (consecutiveFailures > maxAttempts) {
        return;
      }

      onReconnect?.(consecutiveFailures);

      await sleep(delay);
      delay = Math.min(delay * multiplier, maxDelay);
    }
  }

  return reconnecting();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
