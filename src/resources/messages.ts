import { fromGrpcError } from "../errors/error-handler.ts";
import type { MessageServiceClient } from "../transport/grpc-client.ts";
import { mapSendParams } from "../transport/mapper.ts";
import type { RequestOptions } from "../types/client.ts";
import type {
  SendMessageParams,
  SendMessageResult,
} from "../types/messages.ts";

export class MessagesResource {
  private readonly _client: MessageServiceClient;

  constructor(client: MessageServiceClient) {
    this._client = client;
  }

  async send(
    params: SendMessageParams,
    options?: RequestOptions,
  ): Promise<SendMessageResult> {
    try {
      const request = mapSendParams(params);
      const response = await this._client.sendMessage(request, {
        signal: options?.signal,
      });
      return {
        messageId: response.messageId,
        messageStatus: response.messageStatus,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  async markRead(
    messageId: string,
    options?: RequestOptions,
  ): Promise<void> {
    try {
      await this._client.markRead({ messageId }, { signal: options?.signal });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }
}
