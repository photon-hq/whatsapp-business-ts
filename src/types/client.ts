import type { RetryOptions } from "./common.ts";

export interface WhatsAppCredentials {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly appSecret: string;
}

export interface ClientOptions extends WhatsAppCredentials {
  /** Server address, e.g. `"127.0.0.1:50051"`. */
  readonly address: string;
  /**
   * Whether to use TLS. If `true`, the channel uses SSL credentials.
   * Defaults to `false` (insecure).
   */
  readonly tls?: boolean;
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
