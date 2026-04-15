import { describe, expect, it } from "bun:test";
import { ClientError, Status } from "nice-grpc-common";
import { fromGrpcError } from "../../src/errors/error-handler.ts";
import {
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  WhatsAppError,
} from "../../src/errors/whatsapp-error.ts";

function makeClientError(code: number, details: string): ClientError {
  return new ClientError(
    "/photon.whatsapp.v1.MessageService/SendMessage",
    code,
    details,
  );
}

describe("fromGrpcError", () => {
  it("maps UNAUTHENTICATED to AuthenticationError", () => {
    const err = fromGrpcError(makeClientError(Status.UNAUTHENTICATED, "bad token"));
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe("bad token");
    expect(err.grpcCode).toBe(Status.UNAUTHENTICATED);
  });

  it("maps PERMISSION_DENIED to AuthenticationError", () => {
    const err = fromGrpcError(makeClientError(Status.PERMISSION_DENIED, "forbidden"));
    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it("maps NOT_FOUND to NotFoundError", () => {
    const err = fromGrpcError(makeClientError(Status.NOT_FOUND, "not found"));
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it("maps RESOURCE_EXHAUSTED to RateLimitError", () => {
    const err = fromGrpcError(makeClientError(Status.RESOURCE_EXHAUSTED, "rate limited"));
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it("maps INVALID_ARGUMENT to ValidationError", () => {
    const err = fromGrpcError(makeClientError(Status.INVALID_ARGUMENT, "bad input"));
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("maps FAILED_PRECONDITION to ValidationError", () => {
    const err = fromGrpcError(makeClientError(Status.FAILED_PRECONDITION, "precondition"));
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("maps UNAVAILABLE to ConnectionError", () => {
    const err = fromGrpcError(makeClientError(Status.UNAVAILABLE, "unavailable"));
    expect(err).toBeInstanceOf(ConnectionError);
  });

  it("maps DEADLINE_EXCEEDED to ConnectionError", () => {
    const err = fromGrpcError(makeClientError(Status.DEADLINE_EXCEEDED, "timeout"));
    expect(err).toBeInstanceOf(ConnectionError);
  });

  it("maps unknown status to base WhatsAppError", () => {
    const err = fromGrpcError(makeClientError(Status.INTERNAL, "internal"));
    expect(err).toBeInstanceOf(WhatsAppError);
    expect(err).not.toBeInstanceOf(AuthenticationError);
    expect(err).not.toBeInstanceOf(NotFoundError);
    expect(err).not.toBeInstanceOf(RateLimitError);
    expect(err).not.toBeInstanceOf(ValidationError);
    expect(err).not.toBeInstanceOf(ConnectionError);
  });

  it("wraps non-gRPC error in base WhatsAppError", () => {
    const err = fromGrpcError(new Error("some random error"));
    expect(err).toBeInstanceOf(WhatsAppError);
    expect(err.message).toBe("some random error");
    expect(err.cause).toBeInstanceOf(Error);
  });

  it("wraps non-Error value in base WhatsAppError", () => {
    const err = fromGrpcError("string error");
    expect(err).toBeInstanceOf(WhatsAppError);
    expect(err.message).toBe("string error");
  });

  it("reads retryable from metadata", () => {
    const clientErr = makeClientError(Status.UNAVAILABLE, "retry me");
    // Simulate trailing metadata capture middleware
    Object.defineProperty(clientErr, "metadata", {
      value: {
        get(key: string) {
          if (key === "x-retryable") return ["true"];
          return [];
        },
      },
    });
    const err = fromGrpcError(clientErr);
    expect(err.retryable).toBe(true);
  });

  it("reads error-code from metadata", () => {
    const clientErr = makeClientError(Status.INVALID_ARGUMENT, "bad");
    Object.defineProperty(clientErr, "metadata", {
      value: {
        get(key: string) {
          if (key === "error-code") return ["invalidArgument"];
          return [];
        },
      },
    });
    const err = fromGrpcError(clientErr);
    expect(err.code).toBe("invalidArgument");
  });
});
