// biome-ignore lint/performance/noBarrelFile: intentional public API surface

// Client
export type { WhatsAppClient } from "./client.ts";
export { createClient } from "./client.ts";
export type {
  ClientOptions,
  RequestOptions,
  WhatsAppCredentials,
} from "./types/client.ts";

// Resources (type-only — instances accessed via client)
export type { MessagesResource } from "./resources/messages.ts";
export type { MediaResource } from "./resources/media.ts";
export type { EventsResource } from "./resources/events.ts";

// Message types
export type {
  ContactCardInput,
  InteractiveInput,
  LocationInput,
  MediaInput,
  MessageContent,
  ReactionInput,
  SendMessageParams,
  SendMessageResult,
  StickerInput,
  TemplateInput,
  TextInput,
} from "./types/messages.ts";

// Event types
export type {
  InboundContent,
  InboundMessage,
  InboundMessageEvent,
  MessageStatus,
  StatusUpdate,
  StatusUpdateEvent,
  WhatsAppEvent,
} from "./types/events.ts";

// Media types
export type {
  MediaUrlResult,
  UploadOptions,
  UploadResult,
} from "./types/media.ts";

// Common types
export type {
  Contact,
  ContactCard,
  Conversation,
  FetchMissedOptions,
  FetchMissedResult,
  InboundButton,
  InboundInteractive,
  InboundMedia,
  InboundSticker,
  Location,
  Order,
  Pricing,
  ReconnectOptions,
  Referral,
  RetryOptions,
  SubscribeOptions,
  SystemMessage,
  WhatsAppApiError,
} from "./types/common.ts";

// Builders — template
export {
  template,
  text,
  image,
  video,
  document,
  location,
  payload,
  couponCode,
  actionJson,
} from "./builders/template.ts";
export type { TemplateParam, CarouselCard } from "./builders/template.ts";

// Builders — interactive
export {
  button,
  buttons,
  flow,
  list,
  product,
  productList,
} from "./builders/interactive.ts";
export type { Button, FlowOptions } from "./builders/interactive.ts";

// Errors
export {
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  WhatsAppError,
} from "./errors/whatsapp-error.ts";
export { ErrorCode } from "./types/errors.ts";

// Streaming
export { TypedEventStream } from "./streaming/event-stream.ts";
