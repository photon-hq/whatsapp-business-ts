/**
 * Auto-reconnecting wrappers for async iterable streams.
 *
 * {@link withReconnect} is the basic version that re-invokes the stream
 * factory after a disconnect with exponential backoff.
 *
 * {@link withResumableReconnect} extends this with cursor-based gap-fill:
 * on reconnect it fetches missed events before resuming the live stream.
 *
 * Both wrappers are ABORTABLE. Calling `.return()` on the returned iterator —
 * which is exactly what {@link TypedEventStream.close} does on teardown/swap —
 * stops the loop promptly, even while it is mid-backoff or blocked on a dead
 * upstream read. This matters because a stream stuck in the failing-retry loop
 * never crosses a `yield`, and a bare async generator only honors a queued
 * `.return()` at a yield point. Without an explicit abort, `close()` on an
 * unhealthy stream would hang forever and the loop would leak as a zombie that
 * keeps firing `onReconnect` — the exact production wedge where a WhatsApp
 * stream, after a token swap, could never re-subscribe against the fresh
 * client and delivery went silent until the webhook was manually re-rolled.
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
  readonly onError?: (error: unknown, attempt: number) => void;
  readonly onReconnect?: (attempt: number) => void;
}

// ---------------------------------------------------------------------------
// Abort handle
// ---------------------------------------------------------------------------

/**
 * A one-shot abort signal the reconnect loop checks cooperatively. `aborted` is
 * the flag; `wait()` hands out a promise that resolves when abort fires so a
 * single in-flight wait — a backoff sleep, or a pending upstream read — can be
 * interrupted instead of riding out a 30s backoff or a dead socket.
 *
 * Crucially, each `wait()` is FRESH and released via its `release()` the moment
 * that wait ends. A long-lived promise raced once per event would retain a
 * reaction per event until teardown — an O(events) leak on a healthy stream.
 * A per-wait promise, dropped after each read, cannot accumulate. Only one wait
 * is ever live at a time (the loop is sequential), so a single slot suffices.
 */
interface AbortHandle {
  abort: () => void;
  aborted: boolean;
  wait: () => { aborted$: Promise<void>; release: () => void };
}

function createAbortHandle(): AbortHandle {
  let currentWake: (() => void) | undefined;
  const handle: AbortHandle = {
    aborted: false,
    abort: () => {
      handle.aborted = true;
      const wake = currentWake;
      currentWake = undefined;
      wake?.();
    },
    wait: () => {
      let resolve!: () => void;
      const aborted$ = new Promise<void>((r) => {
        resolve = r;
      });
      if (handle.aborted) {
        resolve();
        return { aborted$, release: () => undefined };
      }
      currentWake = resolve;
      return {
        aborted$,
        release: () => {
          if (currentWake === resolve) {
            currentWake = undefined;
          }
        },
      };
    },
  };
  return handle;
}

/**
 * Wrap a generator so `.return()` first trips the abort signal — waking a
 * pending backoff sleep and unblocking any in-flight upstream read — before
 * delegating to the generator's own `return()`. This is what makes a consumer's
 * `close()` settle promptly regardless of stream health.
 */
function abortable<T>(
  gen: AsyncGenerator<T>,
  signal: AbortHandle
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next: (...args) => gen.next(...args),
        return: (value?: unknown) => {
          signal.abort();
          return gen.return(value as never);
        },
        throw: (err?: unknown) => {
          // A throw() terminates iteration too; trip the signal so it settles
          // promptly instead of queuing behind a non-yielding retry loop.
          signal.abort();
          return gen.throw(err);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolveOptions(options?: ReconnectOptions): ResolvedOptions {
  return {
    initialDelay: options?.initialDelay ?? 1000,
    maxDelay: options?.maxDelay ?? 30_000,
    multiplier: options?.multiplier ?? 2,
    maxAttempts: options?.maxAttempts ?? Number.POSITIVE_INFINITY,
    onError: options?.onError,
    onReconnect: options?.onReconnect,
  };
}

/**
 * Consume `stream`, yielding each event and resetting backoff on the first one.
 * On abort the in-flight `next()` is abandoned and the upstream is cancelled via
 * its own `return()` so teardown never waits for a dead socket or the next
 * heartbeat on a quiet-but-healthy stream.
 */
async function* consume<T>(
  stream: AsyncIterable<T>,
  state: BackoffState,
  opts: ResolvedOptions,
  signal: AbortHandle
): AsyncGenerator<T> {
  const iterator = stream[Symbol.asyncIterator]();
  let receivedAtLeastOne = false;

  try {
    while (!signal.aborted) {
      const nextPromise = iterator.next();
      // If abort wins the race we abandon nextPromise; keep it handled so a
      // later rejection from a dying socket never surfaces as unhandled.
      nextPromise.catch(() => undefined);
      // Fresh per-read abort promise, released right after — never accumulates.
      const { aborted$, release } = signal.wait();
      let result: IteratorResult<T> | undefined;
      try {
        result = await Promise.race([
          nextPromise,
          aborted$.then(() => undefined),
        ]);
      } finally {
        release();
      }

      if (result === undefined || signal.aborted || result.done) {
        return;
      }

      if (!receivedAtLeastOne) {
        receivedAtLeastOne = true;
        state.consecutiveFailures = 0;
        state.delay = opts.initialDelay;
      }
      yield result.value;
    }
  } finally {
    // Cancel the upstream RPC; fire-and-forget so a half-open socket's teardown
    // never blocks us (mirrors EventsResource._mapStream's own finally).
    Promise.resolve(iterator.return?.(undefined)).catch(() => undefined);
  }
}

/**
 * Sleep for `ms`, resolving early if aborted so a pending backoff never keeps a
 * torn-down stream's loop alive.
 */
function sleep(ms: number, signal: AbortHandle): Promise<void> {
  if (signal.aborted || ms <= 0) {
    return Promise.resolve();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timed = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  const { aborted$, release } = signal.wait();
  return Promise.race([timed, aborted$]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    release();
  });
}

/**
 * Advance backoff after a disconnect. Returns `false` when the loop should stop
 * (attempts exhausted or aborted mid-sleep). `error` is present only when the
 * previous connection ended by throwing — a clean server-side stream end passes
 * `undefined` and reports as a reconnect, not an error.
 */
async function backoff(
  state: BackoffState,
  opts: ResolvedOptions,
  signal: AbortHandle,
  error?: unknown
): Promise<boolean> {
  state.consecutiveFailures++;

  if (state.consecutiveFailures > opts.maxAttempts) {
    return false;
  }

  if (error !== undefined) {
    opts.onError?.(error, state.consecutiveFailures);
  }
  opts.onReconnect?.(state.consecutiveFailures);

  await sleep(state.delay, signal);
  state.delay = Math.min(state.delay * opts.multiplier, opts.maxDelay);
  return !signal.aborted;
}

// ---------------------------------------------------------------------------
// Basic reconnect
// ---------------------------------------------------------------------------

export function withReconnect<T>(
  createStream: () => AsyncIterable<T>,
  options?: ReconnectOptions
): AsyncIterable<T> {
  const opts = resolveOptions(options);
  const signal = createAbortHandle();

  async function* reconnecting(): AsyncGenerator<T> {
    const state: BackoffState = {
      consecutiveFailures: 0,
      delay: opts.initialDelay,
    };

    for (;;) {
      if (signal.aborted) {
        return;
      }

      let failure: unknown;
      try {
        yield* consume(createStream(), state, opts, signal);
      } catch (error) {
        failure = error;
      }

      if (signal.aborted) {
        return;
      }
      if (!(await backoff(state, opts, signal, failure))) {
        return;
      }
    }
  }

  return abortable(reconnecting(), signal);
}

// ---------------------------------------------------------------------------
// Resumable reconnect (with cursor-based gap-fill)
// ---------------------------------------------------------------------------

async function* gapFill<T>(
  fetchMissed: (cursor: string) => Promise<T[]>,
  getCursor: () => string | undefined,
  signal: AbortHandle
): AsyncGenerator<T> {
  const cursor = getCursor();
  if (!cursor || signal.aborted) {
    return;
  }

  // Race the unary fetch against abort so a teardown mid-gap-fill settles
  // promptly instead of waiting out the RPC (and then the consumer's backstop).
  const missedPromise = fetchMissed(cursor);
  missedPromise.catch(() => undefined);
  const { aborted$, release } = signal.wait();
  let missed: T[] | undefined;
  try {
    missed = await Promise.race([
      missedPromise,
      aborted$.then(() => undefined),
    ]);
  } catch {
    // Gap-fill failed — continue with live stream anyway.
    return;
  } finally {
    release();
  }

  if (missed === undefined) {
    return; // aborted
  }
  for (const event of missed) {
    if (signal.aborted) {
      return;
    }
    yield event;
  }
}

export function withResumableReconnect<T>(
  createStream: () => AsyncIterable<T>,
  fetchMissed: (cursor: string) => Promise<T[]>,
  getCursor: () => string | undefined,
  options?: ReconnectOptions
): AsyncIterable<T> {
  const opts = resolveOptions(options);
  const signal = createAbortHandle();

  async function* reconnecting(): AsyncGenerator<T> {
    const state: BackoffState = {
      consecutiveFailures: 0,
      delay: opts.initialDelay,
    };
    let isFirstConnect = true;

    for (;;) {
      if (signal.aborted) {
        return;
      }

      let failure: unknown;
      try {
        if (!isFirstConnect) {
          yield* gapFill(fetchMissed, getCursor, signal);
        }
        // Abort may have fired during gap-fill; don't open a fresh subscribe
        // only for consume to immediately cancel it.
        if (signal.aborted) {
          return;
        }

        isFirstConnect = false;
        yield* consume(createStream(), state, opts, signal);
      } catch (error) {
        failure = error;
      }

      if (signal.aborted) {
        return;
      }
      if (!(await backoff(state, opts, signal, failure))) {
        return;
      }
    }
  }

  return abortable(reconnecting(), signal);
}
