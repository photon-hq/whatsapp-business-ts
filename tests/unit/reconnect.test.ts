import { describe, expect, it } from "bun:test";
import {
  withReconnect,
  withResumableReconnect,
} from "../../src/streaming/reconnect.ts";

describe("withReconnect", () => {
  it("yields items from the stream", async () => {
    const stream = withReconnect(
      () => ({
        async *[Symbol.asyncIterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }),
      { maxAttempts: 0 }
    );

    const items: number[] = [];
    for await (const item of stream) {
      items.push(item);
      if (items.length === 3) {
        break;
      }
    }
    expect(items).toEqual([1, 2, 3]);
  });

  it("reconnects after stream ends", async () => {
    let callCount = 0;
    const stream = withReconnect(
      () => {
        callCount++;
        return {
          async *[Symbol.asyncIterator]() {
            yield callCount * 10;
          },
        };
      },
      { initialDelay: 10, maxAttempts: 3 }
    );

    const items: number[] = [];
    for await (const item of stream) {
      items.push(item);
      if (items.length >= 3) {
        break;
      }
    }
    expect(items).toEqual([10, 20, 30]);
  });
});

describe("withResumableReconnect", () => {
  it("fetches missed events on reconnect", async () => {
    let callCount = 0;
    let lastCursor = "initial";

    const stream = withResumableReconnect<{ value: number; cursor: string }>(
      () => {
        callCount++;
        return {
          async *[Symbol.asyncIterator]() {
            if (callCount === 1) {
              yield { value: 1, cursor: "c1" };
              lastCursor = "c1";
              // Stream ends (simulating disconnect)
              return;
            }
            // Second connection
            yield { value: 10, cursor: "c10" };
            lastCursor = "c10";
          },
        };
      },
      async (cursor) => {
        // Gap-fill: return events between cursor and now
        if (cursor === "c1") {
          return [
            { value: 2, cursor: "c2" },
            { value: 3, cursor: "c3" },
          ];
        }
        return [];
      },
      () => lastCursor,
      { initialDelay: 10, maxAttempts: 2 }
    );

    const items: { value: number; cursor: string }[] = [];
    for await (const item of stream) {
      items.push(item);
      if (items.length >= 4) {
        break;
      }
    }

    expect(items.map((i) => i.value)).toEqual([1, 2, 3, 10]);
  });
});
