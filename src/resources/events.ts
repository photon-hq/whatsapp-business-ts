import { fromGrpcError } from "../errors/error-handler.ts";
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
import type { WhatsAppEvent } from "../types/events.ts";

export class EventsResource {
  private readonly _client: MessageServiceClient;

  constructor(client: MessageServiceClient) {
    this._client = client;
  }

  subscribe(options?: SubscribeOptions): TypedEventStream<WhatsAppEvent> {
    let lastCursor = options?.cursor;

    const stream = withResumableReconnect<WhatsAppEvent>(
      () =>
        this._mapStream(this._client.subscribeEvents({}), (c) => {
          lastCursor = c;
        }),
      async (cursor) => {
        try {
          const response = await this._client.fetchMissedEvents({
            cursor: { value: cursor },
          });
          return response.events
            .map(mapMissedEvent)
            .filter((e): e is WhatsAppEvent => e !== null);
        } catch (err) {
          throw fromGrpcError(err);
        }
      },
      () => lastCursor,
      options?.reconnect,
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
  ): AsyncGenerator<WhatsAppEvent> {
    try {
      for await (const proto of rpcStream) {
        if (proto.cursor) {
          onCursor(proto.cursor.value);
        }
        const event = mapEvent(proto);
        if (event) {
          yield event;
        }
      }
    } catch (err) {
      throw fromGrpcError(err);
    }
  }
}
