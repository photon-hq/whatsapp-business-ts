import type { RetryOptions } from "./common.ts";

export interface WhatsAppCredentials {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly appSecret: string;
}

export interface ClientOptions extends WhatsAppCredentials {
  /**
   * Default timeout in milliseconds for unary RPC calls.
   * Sets a deadline on each call unless one is already provided.
   */
  readonly timeout?: number;
  /**
   * Enable automatic retry with exponential backoff for retryable errors.
   * Pass `true` for default settings, or a `RetryOptions` object to
   * customise the behaviour.
   */
  readonly retry?: boolean | RetryOptions;
}

export interface RequestOptions {
  /** Abort signal for cancelling the request. */
  readonly signal?: AbortSignal;
}
