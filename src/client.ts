import type { EventsResource } from "./resources/events.ts";
import { EventsResource as EventsImpl } from "./resources/events.ts";
import type { MediaResource } from "./resources/media.ts";
import { MediaResource as MediaImpl } from "./resources/media.ts";
import type { MessagesResource } from "./resources/messages.ts";
import { MessagesResource as MessagesImpl } from "./resources/messages.ts";
import { createGrpcClients } from "./transport/grpc-client.ts";
import type { ClientOptions } from "./types/client.ts";

export interface WhatsAppClient extends AsyncDisposable {
  readonly messages: MessagesResource;
  readonly media: MediaResource;
  readonly events: EventsResource;
  close(): Promise<void>;
}

export function createClient(options: ClientOptions): WhatsAppClient {
  const clients = createGrpcClients({
    address: options.address,
    credentials: {
      accessToken: options.accessToken,
      phoneNumberId: options.phoneNumberId,
      appSecret: options.appSecret,
    },
    tls: options.tls,
    timeout: options.timeout,
    retry: options.retry,
  });

  const messages = new MessagesImpl(clients.messages);
  const media = new MediaImpl(clients.media);
  const events = new EventsImpl(clients.messages);

  function close(): Promise<void> {
    clients.channel.close();
    return Promise.resolve();
  }

  return {
    messages,
    media,
    events,
    close,
    async [Symbol.asyncDispose](): Promise<void> {
      await close();
    },
  };
}
