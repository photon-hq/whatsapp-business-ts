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
  /**
   * Invoked before each reconnect attempt. `cause` is the error that ended
   * the previous attempt, and is undefined when the stream simply ended.
   * Without it a caller logging this callback has no way to say *why* the
   * stream is reconnecting.
   */
  readonly onReconnect?: (attempt: number, cause?: unknown) => void;
  /**
   * Aborts the reconnect loop. `TypedEventStream.close()` wires this up, so
   * callers rarely set it directly. Without it a stream that keeps failing
   * before its first event never reaches a yield point, and the loop survives
   * `close()` for the life of the process.
   */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Subscribe / fetch missed
// ---------------------------------------------------------------------------

export interface SubscribeOptions {
  /** Resume from a previously saved cursor. */
  readonly cursor?: string;
  /**
   * Invoked on every frame received from the server, including heartbeats
   * and cursor-only frames that never surface as events. The server
   * heartbeats every ~30s on an otherwise idle stream, so this is the only
   * signal that distinguishes a quiet-but-healthy stream from a silently
   * dead one — key liveness watchdogs on it. Must not throw.
   */
  readonly onActivity?: () => void;
  /** Reconnection configuration for automatic reconnects. */
  readonly reconnect?: ReconnectOptions;
  /**
   * Milliseconds without a single frame (heartbeats included) before the
   * live stream is declared dead and torn down for a reconnect. The server
   * heartbeats every ~30s, so a healthy-but-idle stream never trips this.
   * A half-open connection (LB idle timeout, NAT drop) raises no error at
   * all — this timeout is what converts that silence into the reconnect +
   * missed-event replay path. Default `120000` (4 missed heartbeats).
   * Set `0` to disable.
   */
  readonly stallTimeoutMs?: number;
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
  readonly name?: string;
  readonly waId: string;
}

export interface WhatsAppApiError {
  readonly code: number;
  readonly details?: string;
  readonly href?: string;
  readonly message?: string;
  readonly title: string;
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
  readonly body?: string;
  readonly headline?: string;
  readonly sourceId?: string;
  readonly sourceType: string;
  readonly sourceUrl: string;
}

export interface Conversation {
  readonly expiration?: Date;
  readonly id: string;
  readonly originType: string;
}

export interface Pricing {
  readonly billable: boolean;
  readonly category: string;
  readonly pricingModel: string;
  readonly type: string;
}

export interface Location {
  readonly address?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
}

// ---------------------------------------------------------------------------
// Inbound media types
// ---------------------------------------------------------------------------

export interface InboundMedia {
  readonly caption?: string;
  readonly filename?: string;
  readonly id: string;
  readonly mimeType: string;
  readonly sha256?: string;
  readonly voice?: boolean;
}

export interface InboundSticker {
  readonly animated?: boolean;
  readonly id: string;
  readonly mimeType: string;
  readonly sha256?: string;
}

// ---------------------------------------------------------------------------
// Inbound interactive reply types
// ---------------------------------------------------------------------------

export interface InboundButtonReply {
  readonly id: string;
  readonly title: string;
}

export interface InboundListReply {
  readonly description?: string;
  readonly id: string;
  readonly title: string;
}

export interface InboundNfmReply {
  readonly body?: string;
  readonly name?: string;
  readonly responseJson: string;
}

export type InboundInteractive =
  | { type: "button_reply"; reply: InboundButtonReply }
  | { type: "list_reply"; reply: InboundListReply }
  | { type: "nfm_reply"; reply: InboundNfmReply };

export interface InboundButton {
  readonly payload: string;
  readonly text: string;
}

// ---------------------------------------------------------------------------
// Inbound order types
// ---------------------------------------------------------------------------

export interface OrderProductItem {
  readonly currency: string;
  readonly itemPrice: number;
  readonly productRetailerId: string;
  readonly quantity: number;
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
  readonly newWaId?: string;
  readonly type: string;
  readonly waId?: string;
}

// ---------------------------------------------------------------------------
// Contact card (shared between inbound and outbound)
// ---------------------------------------------------------------------------

export interface ContactCard {
  readonly addresses: readonly ContactAddress[];
  readonly birthday?: string;
  readonly emails: readonly ContactEmail[];
  readonly name: ContactName;
  readonly org?: ContactOrg;
  readonly phones: readonly ContactPhone[];
  readonly urls: readonly ContactUrl[];
}

export interface ContactName {
  readonly firstName?: string;
  readonly formattedName: string;
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
  readonly city?: string;
  readonly country?: string;
  readonly countryCode?: string;
  readonly state?: string;
  readonly street?: string;
  readonly type?: string;
  readonly zip?: string;
}

export interface ContactOrg {
  readonly company?: string;
  readonly department?: string;
  readonly title?: string;
}

export interface ContactUrl {
  readonly type?: string;
  readonly url: string;
}

// ---------------------------------------------------------------------------
// Reaction
// ---------------------------------------------------------------------------

export interface Reaction {
  readonly emoji: string;
  readonly messageId: string;
}
