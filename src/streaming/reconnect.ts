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
  readonly onReconnect?: (attempt: number) => void;
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
    onReconnect: options?.onReconnect,
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
  opts: ResolvedOptions
): Promise<boolean> {
  state.consecutiveFailures++;

  if (state.consecutiveFailures > opts.maxAttempts) {
    return false;
  }

  opts.onReconnect?.(state.consecutiveFailures);

  await sleep(state.delay);
  state.delay = Math.min(state.delay * opts.multiplier, opts.maxDelay);
  return true;
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
      try {
        yield* consumeStream(createStream(), state, opts);
      } catch {
        // Stream errored — fall through to reconnect logic.
      }

      if (!(await backoff(state, opts))) {
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
  fetchMissed: (cursor: string) => Promise<T[]>,
  getCursor: () => string | undefined
): AsyncGenerator<T> {
  const cursor = getCursor();
  if (!cursor) {
    return;
  }

  try {
    const missed = await fetchMissed(cursor);
    for (const event of missed) {
      yield event;
    }
  } catch {
    // Gap-fill failed — continue with live stream anyway.
  }
}

export function withResumableReconnect<T>(
  createStream: () => AsyncIterable<T>,
  fetchMissed: (cursor: string) => Promise<T[]>,
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
      try {
        if (!isFirstConnect) {
          yield* gapFill(fetchMissed, getCursor);
        }

        isFirstConnect = false;
        yield* consumeStream(createStream(), state, opts);
      } catch {
        // Stream errored — fall through to reconnect logic.
      }

      if (!(await backoff(state, opts))) {
        return;
      }
    }
  }

  return reconnecting();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
