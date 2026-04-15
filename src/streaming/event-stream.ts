/**
 * TypedEventStream — the core streaming primitive for the SDK.
 *
 * Wraps an async iterable source (typically from a gRPC server-streaming RPC)
 * and exposes multiple consumption patterns: `for await`, `.on()`, `.filter()`,
 * `.map()`, `.take()`, and `Symbol.asyncDispose`.
 *
 * Only one consumer is allowed per stream instance. Calling `.on()` or
 * iterating a stream that is already being consumed throws an error.
 * Use `.filter()` / `.map()` / `.take()` to derive new streams before
 * consuming them.
 */

export class TypedEventStream<T> implements AsyncIterable<T>, AsyncDisposable {
  private readonly _source: AsyncIterable<T>;
  private readonly _cleanup: (() => Promise<void>) | undefined;
  private _closed = false;
  private _consumed = false;
  private _cancelResolve: (() => void) | undefined;

  constructor(source: AsyncIterable<T>, cleanup?: () => Promise<void>) {
    this._source = source;
    this._cleanup = cleanup;
  }

  // -------------------------------------------------------------------------
  // AsyncIterable
  // -------------------------------------------------------------------------

  [Symbol.asyncIterator](): AsyncIterator<T> {
    this._claimConsumer();
    return this._iterate();
  }

  // -------------------------------------------------------------------------
  // Callback style
  // -------------------------------------------------------------------------

  /**
   * Subscribe to events with a callback. Returns an unsubscribe function that
   * stops the internal consumption loop.
   *
   * The callback may be synchronous or async. If async, back-pressure is
   * applied — the next event is not delivered until the previous callback
   * resolves.
   */
  on(callback: (event: T) => void | Promise<void>): () => void {
    this._claimConsumer();

    let stopped = false;

    const run = async (): Promise<void> => {
      const iter = this._iterate();
      try {
        for (;;) {
          const result = await iter.next();
          if (result.done || stopped) {
            break;
          }
          await callback(result.value);
        }
      } finally {
        await iter.return?.(undefined);
      }
    };

    run();

    return () => {
      stopped = true;
      this.close();
    };
  }

  // -------------------------------------------------------------------------
  // Operators — each returns a NEW TypedEventStream
  // -------------------------------------------------------------------------

  filter<S extends T>(predicate: (event: T) => event is S): TypedEventStream<S>;
  filter(predicate: (event: T) => boolean): TypedEventStream<T>;
  filter(predicate: (event: T) => boolean): TypedEventStream<T> {
    const parent = this;
    async function* filtered(): AsyncGenerator<T> {
      for await (const event of parent) {
        if (predicate(event)) {
          yield event;
        }
      }
    }
    return new TypedEventStream<T>(filtered(), () => parent.close());
  }

  map<U>(transform: (event: T) => U): TypedEventStream<U> {
    const parent = this;
    async function* mapped(): AsyncGenerator<U> {
      for await (const event of parent) {
        yield transform(event);
      }
    }
    return new TypedEventStream<U>(mapped(), () => parent.close());
  }

  take(count: number): TypedEventStream<T> {
    const parent = this;
    async function* taken(): AsyncGenerator<T> {
      let remaining = count;
      for await (const event of parent) {
        if (remaining <= 0) {
          break;
        }
        yield event;
        remaining--;
        if (remaining <= 0) {
          break;
        }
      }
    }
    return new TypedEventStream<T>(taken(), () => parent.close());
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async close(): Promise<void> {
    if (this._closed) {
      return;
    }
    this._closed = true;
    this._cancelResolve?.();
    if (this._cleanup) {
      await this._cleanup();
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private _claimConsumer(): void {
    if (this._closed) {
      throw new Error("Cannot consume a closed TypedEventStream.");
    }
    if (this._consumed) {
      throw new Error(
        "TypedEventStream already has a consumer. " +
          "Each stream instance supports only one consumer. " +
          "Use .filter() / .map() / .take() to derive a new stream before consuming.",
      );
    }
    this._consumed = true;
  }

  private async *_iterate(): AsyncGenerator<T> {
    const iterator = this._source[Symbol.asyncIterator]();

    try {
      while (!this._closed) {
        const nextPromise = iterator.next();
        const result = await Promise.race([nextPromise, this._cancelPromise()]);

        if (result === undefined || this._closed) {
          break;
        }

        if (result.done) {
          break;
        }
        yield result.value;
      }
    } finally {
      await iterator.return?.(undefined);
    }
  }

  private _cancelPromise(): Promise<undefined> {
    if (this._closed) {
      return Promise.resolve(undefined);
    }
    return new Promise<undefined>((resolve) => {
      this._cancelResolve = () => resolve(undefined);
    });
  }
}
