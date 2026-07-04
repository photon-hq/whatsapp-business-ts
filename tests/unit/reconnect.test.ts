import { describe, expect, it } from "bun:test";
import {
  withReconnect,
  withResumableReconnect,
} from "../../src/streaming/reconnect.ts";

const tick = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A createStream that only ever throws — simulates a dead/expired channel. */
const failingStream = (onAttempt?: () => void) => () => ({
  // biome-ignore lint/correctness/useYield: intentionally throws before yielding
  async *[Symbol.asyncIterator]() {
    onAttempt?.();
    throw new Error("UNAVAILABLE: channel closed");
  },
});

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

  it("return() settles promptly when aborted mid gap-fill", async () => {
    let cursor: string | undefined;
    let fetchMissedCalled = false;
    const stream = withResumableReconnect<number>(
      () => ({
        async *[Symbol.asyncIterator]() {
          cursor = "c1";
          yield 1;
          // stream ends → next loop iteration runs gap-fill
        },
      }),
      () => {
        fetchMissedCalled = true;
        return new Promise<number[]>(() => undefined); // hangs forever
      },
      () => cursor,
      { initialDelay: 5, maxDelay: 5 }
    );

    const iter = stream[Symbol.asyncIterator]();
    const first = await iter.next();
    expect(first.value).toBe(1);

    const secondPull = iter.next(); // drives: stream end → backoff → gap-fill (hangs)
    secondPull.catch(() => undefined);
    await tick(40);
    expect(fetchMissedCalled).toBe(true);

    const settled = await Promise.race([
      iter.return?.(undefined).then(() => "settled"),
      tick(1000).then(() => "HUNG"),
    ]);
    expect(settled).toBe("settled");
  });
});

describe("abortable teardown (the silent-stall regression)", () => {
  // The production wedge: a stream stuck in the failing-retry loop never
  // crosses a yield, so a bare generator's queued return() could never run —
  // return()/close() hung forever and the loop leaked as a zombie. These tests
  // pin the fix: return() must settle, and the loop must stop.

  it("return() settles promptly while stuck in the failing-retry loop", async () => {
    let attempts = 0;
    const stream = withReconnect(
      failingStream(() => {
        attempts++;
      }),
      { initialDelay: 10_000, maxDelay: 10_000 } // long backoff, like prod's 30s
    );

    const iterator = stream[Symbol.asyncIterator]();
    const nextPromise = iterator.next();
    nextPromise.catch(() => undefined);

    // Let it fail once and enter the (long) backoff sleep.
    await tick(30);
    expect(attempts).toBeGreaterThanOrEqual(1);

    // This is what TypedEventStream.close() awaits. Before the fix it never
    // resolved because the loop was mid-backoff, not at a yield.
    const returned = await Promise.race([
      iterator.return?.(undefined).then(() => "settled"),
      tick(1000).then(() => "HUNG"),
    ]);

    expect(returned).toBe("settled");
  });

  it("stops the reconnect loop after return() (no zombie)", async () => {
    let attempts = 0;
    const stream = withReconnect(
      failingStream(() => {
        attempts++;
      }),
      { initialDelay: 5, maxDelay: 5 }
    );

    const iterator = stream[Symbol.asyncIterator]();
    iterator.next().catch(() => undefined);

    await tick(40); // several fast retries
    const attemptsAtAbort = attempts;
    expect(attemptsAtAbort).toBeGreaterThan(1);

    await iterator.return?.(undefined);

    // Give the (now-aborted) loop plenty of time to fire more attempts.
    await tick(60);
    // At most one attempt could have been in flight at the moment of abort.
    expect(attempts).toBeLessThanOrEqual(attemptsAtAbort + 1);
  });

  it("for-await break stops a failing loop", async () => {
    let attempts = 0;
    const stream = withReconnect(
      () => {
        attempts++;
        return {
          async *[Symbol.asyncIterator]() {
            if (attempts === 1) {
              yield 1;
            }
            throw new Error("boom");
          },
        };
      },
      { initialDelay: 5, maxDelay: 5 }
    );

    const seen: number[] = [];
    for await (const item of stream) {
      seen.push(item);
      break; // triggers iterator.return() under the hood
    }
    expect(seen).toEqual([1]);

    const attemptsAtBreak = attempts;
    await tick(50);
    expect(attempts).toBeLessThanOrEqual(attemptsAtBreak + 1);
  });

  it("surfaces the underlying failure through onError with the attempt number", async () => {
    const errors: { message: string; attempt: number }[] = [];
    const stream = withReconnect(failingStream(), {
      initialDelay: 5,
      maxDelay: 5,
      onError: (error, attempt) => {
        errors.push({ message: (error as Error).message, attempt });
      },
    });

    const iterator = stream[Symbol.asyncIterator]();
    iterator.next().catch(() => undefined);
    await tick(40);
    await iterator.return?.(undefined);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain("UNAVAILABLE");
    expect(errors[0]?.attempt).toBe(1);
    expect(errors[1]?.attempt).toBe(2);
  });

  it("does not report onError on a clean stream end (only onReconnect)", async () => {
    let calls = 0;
    const errors: unknown[] = [];
    const reconnects: number[] = [];
    const stream = withReconnect(
      () => {
        calls++;
        return {
          async *[Symbol.asyncIterator]() {
            yield calls;
            // clean end, no throw
          },
        };
      },
      {
        initialDelay: 5,
        maxDelay: 5,
        onError: (e) => errors.push(e),
        onReconnect: (attempt) => reconnects.push(attempt),
      }
    );

    // Drive the loop by pulling continuously; each clean end triggers a reconnect.
    const seen: number[] = [];
    for await (const value of stream) {
      seen.push(value);
      if (seen.length >= 3) {
        break;
      }
    }

    expect(seen).toEqual([1, 2, 3]);
    expect(errors).toEqual([]);
    expect(reconnects.length).toBeGreaterThan(0);
  });
});
