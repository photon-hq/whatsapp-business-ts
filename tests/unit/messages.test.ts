import { describe, expect, it } from "bun:test";
import type { MarkReadRequest } from "../../src/generated/photon/whatsapp/v1/message_service.ts";
import { MessagesResource } from "../../src/resources/messages.ts";
import type { MessageServiceClient } from "../../src/transport/grpc-client.ts";

function makeResource() {
  const calls: MarkReadRequest[] = [];
  const client = {
    markRead: (request: MarkReadRequest) => {
      calls.push(request);
      return Promise.resolve({});
    },
  } as unknown as MessageServiceClient;
  return { messages: new MessagesResource(client), calls };
}

describe("MessagesResource.markRead", () => {
  it("sends a plain read receipt by default", async () => {
    const { messages, calls } = makeResource();
    await messages.markRead("wamid.abc");
    expect(calls).toEqual([{ messageId: "wamid.abc", typingIndicator: false }]);
  });

  it("passes typingIndicator through when requested", async () => {
    const { messages, calls } = makeResource();
    await messages.markRead("wamid.abc", { typingIndicator: true });
    expect(calls).toEqual([{ messageId: "wamid.abc", typingIndicator: true }]);
  });
});
