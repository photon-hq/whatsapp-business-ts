import { describe, expect, it } from "bun:test";
import type { SubscribeEventsResponse } from "../../src/generated/photon/whatsapp/v1/message_service.ts";
import { EventsResource } from "../../src/resources/events.ts";
import type { MessageServiceClient } from "../../src/transport/grpc-client.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const heartbeatFrame = { cursor: undefined, heartbeat: {} };

const messageFrame = (id: string, cursor: string) => ({
  cursor: { value: cursor },
  message: {
    id,
    from: "+15550001111",
    timestamp: new Date(0),
    type: "text",
    text: { body: "hi" },
    errors: [],
  },
});

/** Single scripted live stream; fetchMissedEvents always returns nothing. */
function fakeClient(frames: unknown[]): MessageServiceClient {
  return {
    subscribeEvents: () =>
      (async function* () {
        for (const frame of frames) {
          yield frame as SubscribeEventsResponse;
        }
      })(),
    fetchMissedEvents: async () => ({ events: [] }),
  } as unknown as MessageServiceClient;
}

/**
 * Scripted reconnecting client: each subscribeEvents call consumes the next
 * stream factory (an infinite supply of empty streams once scripts run out,
 * so reconnect loops terminate via maxAttempts instead of throwing).
 * Records every fetchMissedEvents cursor.
 */
function fakeReconnectingClient(
  streams: (() => AsyncIterable<unknown>)[],
  onFetchMissed: (cursor: string) => unknown[]
): { client: MessageServiceClient; fetchMissedCursors: string[] } {
  const fetchMissedCursors: string[] = [];
  const client = {
    subscribeEvents: () => {
      const next = streams.shift();
      if (next) {
        return next();
      }
      return (async function* () {
        // ends immediately
      })();
    },
    fetchMissedEvents: async (request: { cursor: { value: string } }) => {
      fetchMissedCursors.push(request.cursor.value);
      return { events: onFetchMissed(request.cursor.value) };
    },
  } as unknown as MessageServiceClient;
  return { client, fetchMissedCursors };
}

const hangForever = () => new Promise<never>(() => undefined);

// Drain the scripted stream once, then stop instead of reconnecting forever.
const noReconnect = { maxAttempts: 0 } as const;

// ---------------------------------------------------------------------------
// onActivity
// ---------------------------------------------------------------------------

describe("EventsResource.subscribe onActivity", () => {
  it("fires for every frame, including heartbeats that never surface", async () => {
    const events = new EventsResource(
      fakeClient([heartbeatFrame, messageFrame("msg1", "c1"), heartbeatFrame])
    );

    let activity = 0;
    const surfaced: string[] = [];
    const stream = events.subscribe({
      onActivity: () => {
        activity += 1;
      },
      reconnect: noReconnect,
    });
    for await (const event of stream) {
      surfaced.push(event.type);
    }

    expect(activity).toBe(3);
    expect(surfaced).toEqual(["message"]);
  });

  it("reports activity on a heartbeat-only stream that yields no events", async () => {
    const events = new EventsResource(
      fakeClient([heartbeatFrame, heartbeatFrame])
    );

    let activity = 0;
    const stream = events.subscribe({
      onActivity: () => {
        activity += 1;
      },
      reconnect: noReconnect,
    });
    for await (const _event of stream) {
      // heartbeats never surface as events
    }

    expect(activity).toBe(2);
  });

  it("consumes normally when onActivity is not provided", async () => {
    const events = new EventsResource(
      fakeClient([heartbeatFrame, messageFrame("msg1", "c1")])
    );

    const surfaced: string[] = [];
    for await (const event of events.subscribe({ reconnect: noReconnect })) {
      surfaced.push(event.type);
    }

    expect(surfaced).toEqual(["message"]);
  });
});

// ---------------------------------------------------------------------------
// Stall detection
// ---------------------------------------------------------------------------

const surfacedIds = async (
  stream: AsyncIterable<import("../../src/types/events.ts").WhatsAppEvent>
): Promise<string[]> => {
  const ids: string[] = [];
  for await (const event of stream) {
    if (event.type === "message") {
      ids.push(event.message.id);
    }
  }
  return ids;
};

describe("EventsResource.subscribe stall detection", () => {
  it("tears down a silent half-open stream and resumes via cursor gap-fill", async () => {
    const { client, fetchMissedCursors } = fakeReconnectingClient(
      [
        // One message, then silence forever — the half-open socket case.
        async function* () {
          yield messageFrame("msg1", "c1");
          await hangForever();
        },
        // Reconnected stream delivers one more message, then ends cleanly.
        async function* () {
          yield messageFrame("msg3", "c3");
        },
      ],
      (cursor) => (cursor === "c1" ? [messageFrame("msg2", "c2")] : [])
    );
    const events = new EventsResource(client);

    const ids = await surfacedIds(
      events.subscribe({
        reconnect: { initialDelay: 1, maxAttempts: 1 },
        stallTimeoutMs: 25,
      })
    );

    // msg1 live, msg2 replayed by gap-fill, msg3 on the new live stream —
    // the stall cost latency, not data.
    expect(ids).toEqual(["msg1", "msg2", "msg3"]);
    expect(fetchMissedCursors[0]).toBe("c1");
  });

  it("does not trip on a healthy stream that is merely slow", async () => {
    const { client, fetchMissedCursors } = fakeReconnectingClient(
      [
        async function* () {
          for (const frame of [
            heartbeatFrame,
            messageFrame("msg1", "c1"),
            heartbeatFrame,
          ]) {
            await new Promise((r) => setTimeout(r, 10));
            yield frame;
          }
        },
      ],
      () => []
    );
    const events = new EventsResource(client);

    const ids = await surfacedIds(
      events.subscribe({ reconnect: noReconnect, stallTimeoutMs: 1000 })
    );

    expect(ids).toEqual(["msg1"]);
    expect(fetchMissedCursors).toEqual([]);
  });

  it("stallTimeoutMs: 0 disables the stall timer", async () => {
    // Control: the same 30ms inter-frame gap DOES trip a 5ms stall timeout,
    // so a passing run below proves 0 disabled the timer rather than the
    // timer never firing.
    const tripped = fakeReconnectingClient(
      [
        async function* () {
          yield messageFrame("msg1", "c1");
          await new Promise((r) => setTimeout(r, 30));
          yield messageFrame("msg2", "c2");
        },
      ],
      () => []
    );
    const trippedIds = await surfacedIds(
      new EventsResource(tripped.client).subscribe({
        reconnect: { initialDelay: 1, maxAttempts: 0 },
        stallTimeoutMs: 5,
      })
    );
    expect(trippedIds).toEqual(["msg1"]);

    const disabled = fakeReconnectingClient(
      [
        async function* () {
          yield messageFrame("msg1", "c1");
          await new Promise((r) => setTimeout(r, 30));
          yield messageFrame("msg2", "c2");
        },
      ],
      () => []
    );
    const ids = await surfacedIds(
      new EventsResource(disabled.client).subscribe({
        reconnect: noReconnect,
        stallTimeoutMs: 0,
      })
    );
    expect(ids).toEqual(["msg1", "msg2"]);
  });

  it("advances the resume cursor past gap-filled events (no duplicate replay)", async () => {
    const { client, fetchMissedCursors } = fakeReconnectingClient(
      [
        // Live msg1, then stall.
        async function* () {
          yield messageFrame("msg1", "c1");
          await hangForever();
        },
        // First reconnect attempt dies before producing a single frame.
        // biome-ignore lint/correctness/useYield: scripted connect failure
        async function* (): AsyncGenerator<unknown> {
          throw new Error("connect failed");
        },
        // Second reconnect succeeds.
        async function* () {
          yield messageFrame("msg3", "c3");
        },
      ],
      (cursor) => (cursor === "c1" ? [messageFrame("msg2", "c2")] : [])
    );
    const events = new EventsResource(client);

    const ids = await surfacedIds(
      events.subscribe({
        reconnect: { initialDelay: 1, maxAttempts: 2 },
        stallTimeoutMs: 25,
      })
    );

    // Without cursor advancement the second gap-fill re-fetches from c1 and
    // msg2 is delivered twice.
    expect(ids).toEqual(["msg1", "msg2", "msg3"]);
    // First gap-fill from the live cursor, second from the gap-filled one.
    expect(fetchMissedCursors[0]).toBe("c1");
    expect(fetchMissedCursors[1]).toBe("c2");
  });

  it("advances the resume cursor from raw replay frames, not only surfaced events", async () => {
    // A replay batch may END with frames mapMissedEvent drops (e.g. an event
    // type this SDK version doesn't know). The cursor must still advance past
    // them — mirroring the live path, which advances from the raw frame
    // before mapping — or every later reconnect re-fetches the same tail.
    const unknownFrame = (cursor: string) => ({ cursor: { value: cursor } });
    const { client, fetchMissedCursors } = fakeReconnectingClient(
      [
        async function* () {
          yield messageFrame("msg1", "c1");
          await hangForever();
        },
        // biome-ignore lint/correctness/useYield: scripted connect failure
        async function* (): AsyncGenerator<unknown> {
          throw new Error("connect failed");
        },
        async function* () {
          yield messageFrame("msg4", "c4");
        },
      ],
      (cursor) =>
        cursor === "c1" ? [messageFrame("msg2", "c2"), unknownFrame("c3")] : []
    );
    const events = new EventsResource(client);

    const ids = await surfacedIds(
      events.subscribe({
        reconnect: { initialDelay: 1, maxAttempts: 2 },
        stallTimeoutMs: 25,
      })
    );

    expect(ids).toEqual(["msg1", "msg2", "msg4"]);
    expect(fetchMissedCursors[0]).toBe("c1");
    // The second gap-fill resumes from the raw trailing frame's cursor (c3),
    // not the last surfaced event's (c2).
    expect(fetchMissedCursors[1]).toBe("c3");
  });
});
