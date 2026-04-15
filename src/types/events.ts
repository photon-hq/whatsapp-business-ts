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

export type MessageStatus = "sent" | "delivered" | "read" | "played" | "failed";

// ---------------------------------------------------------------------------
// Top-level event discriminated union
// ---------------------------------------------------------------------------

export type WhatsAppEvent = InboundMessageEvent | StatusUpdateEvent;

export interface InboundMessageEvent {
  readonly cursor: string;
  readonly message: InboundMessage;
  readonly type: "message";
}

export interface StatusUpdateEvent {
  readonly cursor: string;
  readonly status: StatusUpdate;
  readonly type: "status";
}

// ---------------------------------------------------------------------------
// Inbound message
// ---------------------------------------------------------------------------

export interface InboundMessage {
  readonly contact?: Contact;
  readonly content: InboundContent;
  readonly context?: MessageContext;
  readonly errors: readonly WhatsAppApiError[];
  readonly from: string;
  readonly id: string;
  readonly messageType: string;
  readonly referral?: Referral;
  readonly timestamp: Date;
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
  readonly bizOpaqueCallbackData?: string;
  readonly conversation?: Conversation;
  readonly errors: readonly WhatsAppApiError[];
  readonly id: string;
  readonly pricing?: Pricing;
  readonly recipientId: string;
  readonly status: MessageStatus;
  readonly timestamp: Date;
}
