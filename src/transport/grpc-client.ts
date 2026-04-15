/**
 * Creates and configures the nice-grpc channel and both service clients.
 *
 * This module is the single entry point for establishing a gRPC connection.
 * It wires up channel creation, auth middleware, optional retry/timeout
 * middleware, and returns typed clients for every service defined in the
 * proto contract.
 */

import {
  type Channel,
  ChannelCredentials,
  createChannel,
  createClientFactory,
} from "nice-grpc";
import type { MediaServiceClient } from "../generated/photon/whatsapp/v1/media_service.ts";
import { MediaServiceDefinition } from "../generated/photon/whatsapp/v1/media_service.ts";
import type { MessageServiceClient } from "../generated/photon/whatsapp/v1/message_service.ts";
import { MessageServiceDefinition } from "../generated/photon/whatsapp/v1/message_service.ts";
import type { WhatsAppCredentials } from "../types/client.ts";
import type { RetryOptions } from "../types/common.ts";
import {
  authMiddleware,
  retryMiddleware,
  timeoutMiddleware,
  trailingMetadataCaptureMiddleware,
} from "./middleware.ts";

// ---------------------------------------------------------------------------
// Re-exports for resource classes
// ---------------------------------------------------------------------------

export type { MediaServiceClient } from "../generated/photon/whatsapp/v1/media_service.ts";
export type { MessageServiceClient } from "../generated/photon/whatsapp/v1/message_service.ts";

// ---------------------------------------------------------------------------
// GrpcClients interface
// ---------------------------------------------------------------------------

/**
 * Container for all gRPC service clients and the underlying channel.
 *
 * The `channel` is exposed so the caller can close it when done (or use
 * the client's `AsyncDisposable` implementation).
 */
export interface GrpcClients {
  readonly channel: Channel;
  readonly media: MediaServiceClient;
  readonly messages: MessageServiceClient;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const SERVER_ADDRESS =
  process.env.WHATSAPP_BUSINESS_ENDPOINT ??
  "whatsapp-business-grpc.spectrum.photon.codes:443";

export interface GrpcClientOptions {
  /** Credentials for the WhatsApp Business API. */
  credentials: WhatsAppCredentials;
  /**
   * Enable automatic retry with exponential backoff for retryable errors.
   * Pass `true` for default settings, or a `RetryOptions` object to
   * customise the behaviour.
   */
  retry?: boolean | RetryOptions;
  /**
   * Default timeout in milliseconds for unary RPC calls.
   * Sets a deadline on each call unless one is already provided.
   */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a gRPC channel and both service clients with the configured
 * middleware.
 */
export function createGrpcClients(options: GrpcClientOptions): GrpcClients {
  // --- Channel ---
  const channel = createChannel(
    SERVER_ADDRESS,
    ChannelCredentials.createSsl(),
    {
      "grpc.keepalive_time_ms": 60_000,
      "grpc.keepalive_timeout_ms": 20_000,
    }
  );

  // --- Client factory with middleware ---
  //
  // Middleware is added outermost-first: the first .use() call runs first
  // in the call chain. Desired execution order:
  //   retry → timeout → auth → trailingMetadataCapture → RPC
  let factory = createClientFactory();

  if (options.retry) {
    const retryOpts = options.retry === true ? {} : options.retry;
    factory = factory.use(retryMiddleware(retryOpts));
  }

  if (options.timeout) {
    factory = factory.use(timeoutMiddleware(options.timeout));
  }

  factory = factory.use(authMiddleware(options.credentials));

  // Always capture trailing metadata — nice-grpc strips it from errors,
  // but our error handler and retry middleware depend on it.
  factory = factory.use(trailingMetadataCaptureMiddleware());

  // --- Create clients ---
  return {
    messages: factory.create(MessageServiceDefinition, channel),
    media: factory.create(MediaServiceDefinition, channel),
    channel,
  };
}
