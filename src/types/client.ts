import type { RetryOptions } from "./common.ts";

export interface WhatsAppCredentials {
  readonly accessToken: string;
  readonly appSecret: string;
  readonly phoneNumberId: string;
}

export interface ClientOptions extends WhatsAppCredentials {
  /**
   * Enable automatic retry with exponential backoff for retryable errors.
   * Pass `true` for default settings, or a `RetryOptions` object to
   * customise the behaviour.
   */
  readonly retry?: boolean | RetryOptions;
  /**
   * Default timeout in milliseconds for unary RPC calls.
   * Sets a deadline on each call unless one is already provided.
   */
  readonly timeout?: number;
}

export interface RequestOptions {
  /** Abort signal for cancelling the request. */
  readonly signal?: AbortSignal;
}
