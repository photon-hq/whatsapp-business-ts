/**
 * Canonical error codes returned by the server.
 *
 * Modelled as an `as const` object so that both the runtime values and the
 * union type are available, with full autocomplete.
 */

export const ErrorCode = {
  // Authentication / authorization
  unauthenticated: "unauthenticated",
  unauthorized: "unauthorized",

  // Rate limiting
  rateLimitExceeded: "rateLimitExceeded",

  // Not found
  notFound: "notFound",

  // Validation / precondition
  invalidArgument: "invalidArgument",
  preconditionFailed: "preconditionFailed",

  // Infrastructure
  serviceUnavailable: "serviceUnavailable",
  timeout: "timeout",
  internalError: "internalError",
  networkError: "networkError",
} as const;

/** Union of all known error code strings. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
