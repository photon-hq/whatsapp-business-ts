import { describe, expect, it } from "bun:test";
import { MessageStatus } from "../../src/generated/photon/whatsapp/v1/message_service.ts";
import {
  mapEvent,
  mapInboundMessage,
  mapMissedEvent,
  mapSendParams,
} from "../../src/transport/mapper.ts";
import type { SendMessageParams } from "../../src/types/messages.ts";

describe("mapSendParams", () => {
  it("maps text string shorthand", () => {
    const params: SendMessageParams = { to: "+1234", text: "Hello" };
    const result = mapSendParams(params);
    expect(result.to).toBe("+1234");
    expect(result.text).toEqual({ body: "Hello" });
  });

  it("maps text object with previewUrl", () => {
    const params: SendMessageParams = {
      to: "+1234",
      text: { body: "https://example.com", previewUrl: true },
    };
    const result = mapSendParams(params);
    expect(result.text).toEqual({
      body: "https://example.com",
      previewUrl: true,
    });
  });

  it("maps image with link", () => {
    const params: SendMessageParams = {
      to: "+1234",
      image: { link: "https://img.com/photo.jpg", caption: "Photo" },
    };
    const result = mapSendParams(params);
    expect(result.image?.link).toBe("https://img.com/photo.jpg");
    expect(result.image?.caption).toBe("Photo");
  });

  it("maps video", () => {
    const result = mapSendParams({ to: "+1", video: { id: "vid123" } });
    expect(result.video?.id).toBe("vid123");
  });

  it("maps audio", () => {
    const result = mapSendParams({
      to: "+1",
      audio: { link: "https://a.mp3" },
    });
    expect(result.audio?.link).toBe("https://a.mp3");
  });

  it("maps document", () => {
    const result = mapSendParams({
      to: "+1",
      document: { id: "doc1", filename: "invoice.pdf" },
    });
    expect(result.document?.id).toBe("doc1");
    expect(result.document?.filename).toBe("invoice.pdf");
  });

  it("maps sticker", () => {
    const result = mapSendParams({ to: "+1", sticker: { id: "stk1" } });
    expect(result.sticker?.id).toBe("stk1");
  });

  it("maps location", () => {
    const result = mapSendParams({
      to: "+1",
      location: { latitude: 37.7749, longitude: -122.4194, name: "SF" },
    });
    expect(result.location?.latitude).toBe(37.7749);
    expect(result.location?.name).toBe("SF");
  });

  it("maps reaction", () => {
    const result = mapSendParams({
      to: "+1",
      reaction: { messageId: "msg1", emoji: "👍" },
    });
    expect(result.reaction?.messageId).toBe("msg1");
    expect(result.reaction?.emoji).toBe("👍");
  });

  it("maps contacts", () => {
    const result = mapSendParams({
      to: "+1",
      contacts: [
        {
          name: { formattedName: "John Doe" },
          phones: [{ phone: "+1234" }],
          emails: [],
          addresses: [],
          urls: [],
        },
      ],
    });
    expect(result.contacts.length).toBe(1);
    expect(result.contacts[0]?.name?.formattedName).toBe("John Doe");
  });

  it("maps replyTo and bizOpaqueCallbackData", () => {
    const result = mapSendParams({
      to: "+1",
      text: "Hi",
      replyTo: "wamid.xxx",
      bizOpaqueCallbackData: "cb123",
    });
    expect(result.replyToMessageId).toBe("wamid.xxx");
    expect(result.bizOpaqueCallbackData).toBe("cb123");
  });

  it("maps template", () => {
    const result = mapSendParams({
      to: "+1",
      template: {
        name: "order_update",
        languageCode: "en_US",
        components: [
          { type: "body", parameters: [{ type: "text", text: "John" }] },
        ],
      },
    });
    expect(result.template?.name).toBe("order_update");
    expect(result.template?.components.length).toBe(1);
  });

  it("maps interactive", () => {
    const result = mapSendParams({
      to: "+1",
      interactive: {
        type: "button",
        body: "Choose",
        action: {
          buttons: [{ type: "reply", reply: { id: "a", title: "A" } }],
        },
      },
    });
    expect(result.interactive?.type).toBe("button");
  });
});

describe("mapInboundMessage", () => {
  it("maps text message", () => {
    const result = mapInboundMessage({
      id: "msg1",
      from: "+1234",
      timestamp: new Date("2024-01-01"),
      type: "text",
      text: { body: "Hello" },
      contacts: [],
      errors: [],
    } as any);
    expect(result.content.type).toBe("text");
    if (result.content.type === "text") {
      expect(result.content.body).toBe("Hello");
    }
  });

  it("maps image message", () => {
    const result = mapInboundMessage({
      id: "msg2",
      from: "+1234",
      timestamp: new Date(),
      type: "image",
      image: { id: "img1", mimeType: "image/jpeg" },
      contacts: [],
      errors: [],
    } as any);
    expect(result.content.type).toBe("image");
    if (result.content.type === "image") {
      expect(result.content.media.id).toBe("img1");
    }
  });

  it("maps unknown type", () => {
    const result = mapInboundMessage({
      id: "msg3",
      from: "+1234",
      timestamp: new Date(),
      type: "some_future_type",
      contacts: [],
      errors: [],
    } as any);
    expect(result.content.type).toBe("unknown");
  });
});

describe("mapEvent", () => {
  it("maps message event", () => {
    const result = mapEvent({
      cursor: { value: "cursor1" },
      message: {
        id: "msg1",
        from: "+1234",
        timestamp: new Date(),
        type: "text",
        text: { body: "Hi" },
        contacts: [],
        errors: [],
      },
    } as any);
    expect(result?.type).toBe("message");
    expect(result?.cursor).toBe("cursor1");
  });

  it("maps status event", () => {
    const result = mapEvent({
      cursor: { value: "cursor2" },
      status: {
        id: "msg1",
        status: MessageStatus.MESSAGE_STATUS_DELIVERED,
        timestamp: new Date(),
        recipientId: "+1234",
        errors: [],
      },
    } as any);
    expect(result?.type).toBe("status");
    if (result?.type === "status") {
      expect(result.status.status).toBe("delivered");
    }
  });

  it("returns null for heartbeat", () => {
    const result = mapEvent({
      cursor: { value: "cursor3" },
      heartbeat: {},
    } as any);
    expect(result).toBeNull();
  });
});

describe("mapMissedEvent", () => {
  it("maps missed message event", () => {
    const result = mapMissedEvent({
      cursor: { value: "c1" },
      message: {
        id: "msg1",
        from: "+1",
        timestamp: new Date(),
        type: "text",
        text: { body: "Missed" },
        contacts: [],
        errors: [],
      },
    } as any);
    expect(result?.type).toBe("message");
  });

  it("returns null for empty payload", () => {
    const result = mapMissedEvent({ cursor: { value: "c2" } } as any);
    expect(result).toBeNull();
  });
});
