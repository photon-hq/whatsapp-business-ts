import type {
  Contact,
  ContactCard,
  Conversation,
  InboundButton,
  InboundInteractive,
  InboundMedia,
  InboundSticker,
  Location,
  MessageContext,
  Order,
  Pricing,
  Reaction,
  Referral,
  SystemMessage,
  WhatsAppApiError,
} from "./common.ts";

// ---------------------------------------------------------------------------
// Message status (string literal union, mapped from proto enum)
// ---------------------------------------------------------------------------

export type MessageStatus =
  | "sent"
  | "delivered"
  | "read"
  | "played"
  | "failed";

// ---------------------------------------------------------------------------
// Top-level event discriminated union
// ---------------------------------------------------------------------------

export type WhatsAppEvent = InboundMessageEvent | StatusUpdateEvent;

export interface InboundMessageEvent {
  readonly type: "message";
  readonly cursor: string;
  readonly message: InboundMessage;
}

export interface StatusUpdateEvent {
  readonly type: "status";
  readonly cursor: string;
  readonly status: StatusUpdate;
}

// ---------------------------------------------------------------------------
// Inbound message
// ---------------------------------------------------------------------------

export interface InboundMessage {
  readonly id: string;
  readonly from: string;
  readonly timestamp: Date;
  readonly messageType: string;
  readonly contact?: Contact;
  readonly content: InboundContent;
  readonly context?: MessageContext;
  readonly referral?: Referral;
  readonly errors: readonly WhatsAppApiError[];
}

// ---------------------------------------------------------------------------
// Inbound content discriminated union
// ---------------------------------------------------------------------------

export type InboundContent =
  | { readonly type: "text"; readonly body: string }
  | { readonly type: "image"; readonly media: InboundMedia }
  | { readonly type: "video"; readonly media: InboundMedia }
  | { readonly type: "audio"; readonly media: InboundMedia }
  | { readonly type: "document"; readonly media: InboundMedia }
  | { readonly type: "sticker"; readonly sticker: InboundSticker }
  | { readonly type: "location"; readonly location: Location }
  | { readonly type: "contacts"; readonly contacts: readonly ContactCard[] }
  | { readonly type: "reaction"; readonly reaction: Reaction }
  | { readonly type: "interactive"; readonly interactive: InboundInteractive }
  | { readonly type: "button"; readonly button: InboundButton }
  | { readonly type: "order"; readonly order: Order }
  | { readonly type: "system"; readonly system: SystemMessage }
  | { readonly type: "unknown" };

// ---------------------------------------------------------------------------
// Status update
// ---------------------------------------------------------------------------

export interface StatusUpdate {
  readonly id: string;
  readonly status: MessageStatus;
  readonly timestamp: Date;
  readonly recipientId: string;
  readonly conversation?: Conversation;
  readonly pricing?: Pricing;
  readonly errors: readonly WhatsAppApiError[];
  readonly bizOpaqueCallbackData?: string;
}
