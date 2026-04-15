// ---------------------------------------------------------------------------
// Retry / reconnection options
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Initial delay in milliseconds before the first retry. Default `200`. */
  readonly initialDelay?: number;
  /** Maximum number of attempts including the initial call. Default `4`. */
  readonly maxAttempts?: number;
  /** Maximum delay in milliseconds between retries. Default `5000`. */
  readonly maxDelay?: number;
}

export interface ReconnectOptions {
  /** Initial delay in milliseconds before the first reconnect. Default `1000`. */
  readonly initialDelay?: number;
  /** Maximum number of consecutive reconnect attempts. Default `Infinity`. */
  readonly maxAttempts?: number;
  /** Maximum delay in milliseconds between retries. Default `30000`. */
  readonly maxDelay?: number;
  /** Multiplier applied to the delay after each failed attempt. Default `2`. */
  readonly multiplier?: number;
  /** Callback invoked before each reconnect attempt. */
  readonly onReconnect?: (attempt: number) => void;
}

// ---------------------------------------------------------------------------
// Subscribe / fetch missed
// ---------------------------------------------------------------------------

export interface SubscribeOptions {
  /** Resume from a previously saved cursor. */
  readonly cursor?: string;
  /** Reconnection configuration for automatic reconnects. */
  readonly reconnect?: ReconnectOptions;
}

export interface FetchMissedOptions {
  /** The cursor from the last received event. */
  readonly cursor: string;
  /** Maximum number of events to return. */
  readonly limit?: number;
}

export interface FetchMissedResult {
  /** Missed events since the given cursor. */
  readonly events: readonly import("./events.ts").WhatsAppEvent[];
}

// ---------------------------------------------------------------------------
// Shared domain types
// ---------------------------------------------------------------------------

export interface Contact {
  readonly waId: string;
  readonly name?: string;
}

export interface WhatsAppApiError {
  readonly code: number;
  readonly title: string;
  readonly message?: string;
  readonly details?: string;
  readonly href?: string;
}

export interface MessageContext {
  readonly forwarded?: boolean;
  readonly frequentlyForwarded?: boolean;
  readonly from?: string;
  readonly id?: string;
  readonly referredProduct?: ReferredProduct;
}

export interface ReferredProduct {
  readonly catalogId: string;
  readonly productRetailerId: string;
}

export interface Referral {
  readonly sourceUrl: string;
  readonly sourceType: string;
  readonly sourceId?: string;
  readonly headline?: string;
  readonly body?: string;
}

export interface Conversation {
  readonly id: string;
  readonly originType: string;
  readonly expiration?: Date;
}

export interface Pricing {
  readonly billable: boolean;
  readonly pricingModel: string;
  readonly type: string;
  readonly category: string;
}

export interface Location {
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
  readonly address?: string;
}

// ---------------------------------------------------------------------------
// Inbound media types
// ---------------------------------------------------------------------------

export interface InboundMedia {
  readonly id: string;
  readonly mimeType: string;
  readonly sha256?: string;
  readonly caption?: string;
  readonly filename?: string;
  readonly voice?: boolean;
}

export interface InboundSticker {
  readonly id: string;
  readonly mimeType: string;
  readonly sha256?: string;
  readonly animated?: boolean;
}

// ---------------------------------------------------------------------------
// Inbound interactive reply types
// ---------------------------------------------------------------------------

export interface InboundButtonReply {
  readonly id: string;
  readonly title: string;
}

export interface InboundListReply {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

export interface InboundNfmReply {
  readonly name?: string;
  readonly body?: string;
  readonly responseJson: string;
}

export type InboundInteractive =
  | { type: "button_reply"; reply: InboundButtonReply }
  | { type: "list_reply"; reply: InboundListReply }
  | { type: "nfm_reply"; reply: InboundNfmReply };

export interface InboundButton {
  readonly text: string;
  readonly payload: string;
}

// ---------------------------------------------------------------------------
// Inbound order types
// ---------------------------------------------------------------------------

export interface OrderProductItem {
  readonly productRetailerId: string;
  readonly quantity: number;
  readonly itemPrice: number;
  readonly currency: string;
}

export interface Order {
  readonly catalogId: string;
  readonly productItems: readonly OrderProductItem[];
  readonly text?: string;
}

// ---------------------------------------------------------------------------
// System message
// ---------------------------------------------------------------------------

export interface SystemMessage {
  readonly body: string;
  readonly type: string;
  readonly newWaId?: string;
  readonly waId?: string;
}

// ---------------------------------------------------------------------------
// Contact card (shared between inbound and outbound)
// ---------------------------------------------------------------------------

export interface ContactCard {
  readonly name: ContactName;
  readonly phones: readonly ContactPhone[];
  readonly emails: readonly ContactEmail[];
  readonly addresses: readonly ContactAddress[];
  readonly org?: ContactOrg;
  readonly urls: readonly ContactUrl[];
  readonly birthday?: string;
}

export interface ContactName {
  readonly formattedName: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly middleName?: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

export interface ContactPhone {
  readonly phone: string;
  readonly type?: string;
  readonly waId?: string;
}

export interface ContactEmail {
  readonly email: string;
  readonly type?: string;
}

export interface ContactAddress {
  readonly street?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zip?: string;
  readonly country?: string;
  readonly countryCode?: string;
  readonly type?: string;
}

export interface ContactOrg {
  readonly company?: string;
  readonly department?: string;
  readonly title?: string;
}

export interface ContactUrl {
  readonly url: string;
  readonly type?: string;
}

// ---------------------------------------------------------------------------
// Reaction
// ---------------------------------------------------------------------------

export interface Reaction {
  readonly messageId: string;
  readonly emoji: string;
}
