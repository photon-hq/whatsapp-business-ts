import { describe, expect, it } from "bun:test";
import {
  withReconnect,
  withResumableReconnect,
} from "../../src/streaming/reconnect.ts";

// Timings for the cancellation tests: long enough that a loop takes several
// backoff ticks inside an observation window, short enough to keep the suite
// fast. Every one of these tests hangs to timeout if abort is not honoured,
// so these bound the happy path only.

/** Backoff delay, pinned flat (initial === max) so ticks stay countable. */
const RETRY_DELAY_MS = 5;
/** Time given to a failing loop to spin before the abort under test. */
const SETTLE_WINDOW_MS = 40;
/** Time watched after an abort to prove nothing keeps ticking. */
const POST_ABORT_WINDOW_MS = 40;
/** Time given to a failing loop to record at least one onReconnect cause. */
const CAUSE_OBSERVATION_WINDOW_MS = 30;

const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
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
});

describe("reconnect cancellation", () => {
  // Reproduces the production leak: a line whose client is closed fails on
  // every connect attempt, so the generator never reaches a yield point and a
  // queued `return()` can never land. Before the signal existed this loop
  // outlived close() forever, emitting one onReconnect per backoff until the
  // process died.
  it("terminates a loop that never yielded, and stops reconnecting", async () => {
    const controller = new AbortController();
    let attempts = 0;
    let created = 0;

    const stream = withResumableReconnect<number>(
      () => {
        created++;
        return {
          // biome-ignore lint/correctness/useYield: models a stream that always fails before its first event
          async *[Symbol.asyncIterator]() {
            throw new Error("connect failed");
          },
        };
      },
      () => Promise.resolve([]),
      () => undefined,
      {
        initialDelay: RETRY_DELAY_MS,
        maxDelay: RETRY_DELAY_MS,
        onReconnect: () => {
          attempts++;
        },
        signal: controller.signal,
      }
    );

    const iterator = stream[Symbol.asyncIterator]();
    const next = iterator.next();

    // Let it spin through a few failed connects, then abort mid-backoff.
    await delay(SETTLE_WINDOW_MS);
    const attemptsAtAbort = attempts;
    expect(attemptsAtAbort).toBeGreaterThan(0);

    controller.abort();

    // The pending next() resolves as done rather than hanging: the loop
    // returned instead of sleeping out its backoff.
    const result = await next;
    expect(result.done).toBe(true);

    // And nothing keeps ticking afterwards.
    const createdAtAbort = created;
    await delay(POST_ABORT_WINDOW_MS);
    expect(attempts).toBe(attemptsAtAbort);
    expect(created).toBe(createdAtAbort);
  });

  // The backoff sleep is not the only wait without a yield point beneath it:
  // gap-fill awaits a unary RPC, and on a half-open connection that call can
  // stay pending long past the close that should have ended the loop.
  it("terminates while a gap-fill is still in flight", async () => {
    const controller = new AbortController();
    let created = 0;
    let fetchMissedSignal: AbortSignal | undefined;

    const stream = withResumableReconnect<number>(
      () => {
        created++;
        return {
          async *[Symbol.asyncIterator]() {
            // One event, then a disconnect — so the next iteration is a
            // reconnect, which is the path that gap-fills.
            yield 1;
          },
        };
      },
      (_cursor, signal) => {
        fetchMissedSignal = signal;
        // Never settles: the call the loop cannot see the end of.
        return new Promise<number[]>(() => undefined);
      },
      () => "cursor-1",
      {
        initialDelay: RETRY_DELAY_MS,
        maxDelay: RETRY_DELAY_MS,
        signal: controller.signal,
      }
    );

    const iterator = stream[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toBe(1);

    // Second next() drives the reconnect and parks in gap-fill.
    const pending = iterator.next();
    await delay(SETTLE_WINDOW_MS);
    const createdAtAbort = created;

    controller.abort();

    // Resolves instead of hanging on the never-settling fetch, and the RPC
    // itself is cancelled rather than left running.
    expect((await pending).done).toBe(true);
    expect(fetchMissedSignal?.aborted).toBe(true);

    // No live stream is opened after the abort, either.
    await delay(POST_ABORT_WINDOW_MS);
    expect(created).toBe(createdAtAbort);
  });

  it("does not fire onReconnect when aborted before the callback", async () => {
    const controller = new AbortController();
    controller.abort();
    let attempts = 0;

    const stream = withReconnect<number>(
      () => ({
        // biome-ignore lint/correctness/useYield: models a stream that always fails before its first event
        async *[Symbol.asyncIterator]() {
          throw new Error("connect failed");
        },
      }),
      {
        initialDelay: RETRY_DELAY_MS,
        onReconnect: () => {
          attempts++;
        },
        signal: controller.signal,
      }
    );

    const items: number[] = [];
    for await (const item of stream) {
      items.push(item);
    }
    expect(items).toEqual([]);
    expect(attempts).toBe(0);
  });
});

describe("onReconnect cause", () => {
  it("forwards the error that ended the previous attempt", async () => {
    const causes: unknown[] = [];
    const controller = new AbortController();

    const stream = withReconnect<number>(
      () => ({
        // biome-ignore lint/correctness/useYield: models a stream that always fails before its first event
        async *[Symbol.asyncIterator]() {
          throw new Error("boom");
        },
      }),
      {
        initialDelay: RETRY_DELAY_MS,
        maxDelay: RETRY_DELAY_MS,
        onReconnect: (_attempt, cause) => {
          causes.push(cause);
        },
        signal: controller.signal,
      }
    );

    const iterator = stream[Symbol.asyncIterator]();
    const pending = iterator.next();
    await delay(CAUSE_OBSERVATION_WINDOW_MS);
    controller.abort();
    await pending;

    expect(causes.length).toBeGreaterThan(0);
    expect((causes[0] as Error).message).toBe("boom");
  });
});
