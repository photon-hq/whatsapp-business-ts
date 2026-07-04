import { describe, expect, it } from "bun:test";
import { TypedEventStream } from "../../src/streaming/event-stream.ts";

function createSource<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

describe("TypedEventStream", () => {
  it("iterates with for await", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3]));
    const results: number[] = [];
    for await (const item of stream) {
      results.push(item);
    }
    expect(results).toEqual([1, 2, 3]);
  });

  it("supports .on() callback", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3]));
    const results: number[] = [];

    await new Promise<void>((resolve) => {
      const unsub = stream.on((item) => {
        results.push(item);
        if (results.length === 3) {
          unsub();
          resolve();
        }
      });
    });

    expect(results).toEqual([1, 2, 3]);
  });

  it("supports .filter()", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3, 4, 5]));
    const even = stream.filter((n) => n % 2 === 0);
    const results: number[] = [];
    for await (const item of even) {
      results.push(item);
    }
    expect(results).toEqual([2, 4]);
  });

  it("supports .map()", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3]));
    const doubled = stream.map((n) => n * 2);
    const results: number[] = [];
    for await (const item of doubled) {
      results.push(item);
    }
    expect(results).toEqual([2, 4, 6]);
  });

  it("supports .take()", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3, 4, 5]));
    const first3 = stream.take(3);
    const results: number[] = [];
    for await (const item of first3) {
      results.push(item);
    }
    expect(results).toEqual([1, 2, 3]);
  });

  it("throws on double consumption", () => {
    const stream = new TypedEventStream(createSource([1, 2, 3]));
    // First consumer
    stream.on(() => {
      /* noop */
    });
    // Second consumer should throw
    expect(() => {
      stream[Symbol.asyncIterator]();
    }).toThrow("already has a consumer");
  });

  it("throws on consuming closed stream", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3]));
    await stream.close();
    expect(() =>
      stream.on(() => {
        /* noop */
      })
    ).toThrow("closed");
  });

  it("consumer teardown does not hang on a source whose return() never settles", async () => {
    // Defense-in-depth backstop: even a source that cannot honor return()
    // (e.g. a half-open gRPC read with stall detection off) must not hold the
    // consumer's iteration hostage. In prod the hung party was the wrapper's
    // `for await`, not close() — so assert the pending next() is released.
    let returnCalled = false;
    const wedgedSource: AsyncIterable<number> = {
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<number>>(() => undefined),
          return: () => {
            returnCalled = true;
            // Never resolves — the pathological case the timeout guards.
            return new Promise<IteratorResult<number>>(() => undefined);
          },
        };
      },
    };

    // 50ms teardown cap so the test is fast; production default is 5s.
    const stream = new TypedEventStream(wedgedSource, undefined, 50);
    const iterator = stream[Symbol.asyncIterator]();
    const pending = iterator.next(); // the consumer's blocked read
    pending.catch(() => undefined);

    await new Promise((r) => setTimeout(r, 10));
    stream.close(); // trip cancellation (does not itself await the iteration)

    const settled = await Promise.race([
      pending.then((r) => (r.done ? "released" : "value")),
      new Promise((r) => setTimeout(() => r("HUNG"), 1000)),
    ]);

    expect(settled).toBe("released");
    expect(returnCalled).toBe(true);
  });

  it("supports chaining filter + map + take", async () => {
    const stream = new TypedEventStream(createSource([1, 2, 3, 4, 5, 6, 7, 8]));
    const result = stream
      .filter((n) => n % 2 === 0)
      .map((n) => n * 10)
      .take(2);

    const items: number[] = [];
    for await (const item of result) {
      items.push(item);
    }
    expect(items).toEqual([20, 40]);
  });
});
