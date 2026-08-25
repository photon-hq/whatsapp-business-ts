/**
 * Auto-reconnecting wrappers for async iterable streams.
 *
 * {@link withReconnect} is the basic version that re-invokes the stream
 * factory after a disconnect with exponential backoff.
 *
 * {@link withResumableReconnect} extends this with cursor-based gap-fill:
 * on reconnect it fetches missed events before resuming the live stream.
 */

import type { ReconnectOptions } from "../types/common.ts";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface BackoffState {
  consecutiveFailures: number;
  delay: number;
}

interface ResolvedOptions {
  readonly initialDelay: number;
  readonly maxAttempts: number;
  readonly maxDelay: number;
  readonly multiplier: number;
  readonly onReconnect?: (attempt: number, cause?: unknown) => void;
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Marks a wait that ended in an abort rather than a value. */
const ABORTED = Symbol("aborted");

/**
 * Await `promise`, but give up the moment `signal` aborts.
 *
 * The loop must never park on a call whose result it can no longer use. A
 * unary gap-fill on a half-open connection can stay pending long past the
 * `close()` that ended the loop, and there is no yield point inside that
 * await for a queued `return()` to land on — the same trap as an
 * uninterruptible `sleep()`.
 *
 * A rejection that arrives after the abort is still consumed here, so
 * abandoning the call cannot surface as an unhandled rejection.
 */
function raceAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T | typeof ABORTED> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.resolve(ABORTED);
  }
  return new Promise<T | typeof ABORTED>((resolve, reject) => {
    const onAbort = (): void => resolve(ABORTED);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

function resolveOptions(options?: ReconnectOptions): ResolvedOptions {
  return {
    initialDelay: options?.initialDelay ?? 1000,
    maxDelay: options?.maxDelay ?? 30_000,
    multiplier: options?.multiplier ?? 2,
    maxAttempts: options?.maxAttempts ?? Number.POSITIVE_INFINITY,
    onReconnect: options?.onReconnect,
    signal: options?.signal,
  };
}

async function* consumeStream<T>(
  stream: AsyncIterable<T>,
  state: BackoffState,
  opts: ResolvedOptions
): AsyncGenerator<T> {
  let receivedAtLeastOne = false;

  for await (const event of stream) {
    if (!receivedAtLeastOne) {
      receivedAtLeastOne = true;
      state.consecutiveFailures = 0;
      state.delay = opts.initialDelay;
    }
    yield event;
  }
}

async function backoff(
  state: BackoffState,
  opts: ResolvedOptions,
  cause?: unknown
): Promise<boolean> {
  state.consecutiveFailures++;

  if (state.consecutiveFailures > opts.maxAttempts) {
    return false;
  }

  // Checked before the callback so a stream closed mid-backoff goes quiet
  // immediately rather than emitting one last reconnect notification.
  if (opts.signal?.aborted) {
    return false;
  }

  opts.onReconnect?.(state.consecutiveFailures, cause);

  // A failing stream spends nearly all of its life parked here, so this is the
  // wait that has to be interruptible — a queued `return()` on the generator
  // cannot land while it sleeps.
  await sleep(state.delay, opts.signal);
  state.delay = Math.min(state.delay * opts.multiplier, opts.maxDelay);
  return !opts.signal?.aborted;
}

// ---------------------------------------------------------------------------
// Basic reconnect
// ---------------------------------------------------------------------------

export function withReconnect<T>(
  createStream: () => AsyncIterable<T>,
  options?: ReconnectOptions
): AsyncIterable<T> {
  const opts = resolveOptions(options);

  async function* reconnecting(): AsyncGenerator<T> {
    const state: BackoffState = {
      consecutiveFailures: 0,
      delay: opts.initialDelay,
    };

    for (;;) {
      if (opts.signal?.aborted) {
        return;
      }

      let cause: unknown;
      try {
        yield* consumeStream(createStream(), state, opts);
      } catch (error) {
        // Stream errored — reconnect, but keep the reason: it is the only
        // explanation a caller's onReconnect can surface.
        cause = error;
      }

      if (!(await backoff(state, opts, cause))) {
        return;
      }
    }
  }

  return reconnecting();
}

// ---------------------------------------------------------------------------
// Resumable reconnect (with cursor-based gap-fill)
// ---------------------------------------------------------------------------

async function* gapFill<T>(
  fetchMissed: (cursor: string, signal?: AbortSignal) => Promise<T[]>,
  getCursor: () => string | undefined,
  signal?: AbortSignal
): AsyncGenerator<T> {
  const cursor = getCursor();
  if (!cursor || signal?.aborted) {
    return;
  }

  let missed: T[] | typeof ABORTED;
  try {
    // The signal goes to the fetch so the RPC itself is cancelled, and the
    // wait is raced against it so a fetch that ignores the signal still
    // cannot hold the loop.
    missed = await raceAbort(fetchMissed(cursor, signal), signal);
  } catch {
    // Gap-fill failed — continue with live stream anyway.
    return;
  }

  if (missed === ABORTED) {
    return;
  }

  for (const event of missed) {
    yield event;
  }
}

export function withResumableReconnect<T>(
  createStream: () => AsyncIterable<T>,
  fetchMissed: (cursor: string, signal?: AbortSignal) => Promise<T[]>,
  getCursor: () => string | undefined,
  options?: ReconnectOptions
): AsyncIterable<T> {
  const opts = resolveOptions(options);

  async function* reconnecting(): AsyncGenerator<T> {
    const state: BackoffState = {
      consecutiveFailures: 0,
      delay: opts.initialDelay,
    };
    let isFirstConnect = true;

    for (;;) {
      // Covers an abort that lands while the factory or gap-fill is in flight,
      // where there is still no yield point for a queued `return()` to reach.
      if (opts.signal?.aborted) {
        return;
      }

      let cause: unknown;
      try {
        if (!isFirstConnect) {
          yield* gapFill(fetchMissed, getCursor, opts.signal);
          // Gap-fill spans an await, so an abort can land inside it. Without
          // this check the loop would open one more live stream it has
          // already been told to stop wanting.
          if (opts.signal?.aborted) {
            return;
          }
        }

        isFirstConnect = false;
        yield* consumeStream(createStream(), state, opts);
      } catch (error) {
        // Stream errored — reconnect, but keep the reason: it is the only
        // explanation a caller's onReconnect can surface.
        cause = error;
      }

      if (!(await backoff(state, opts, cause))) {
        return;
      }
    }
  }

  return reconnecting();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
