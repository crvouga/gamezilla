import type { Timers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';

export interface FetchRetryOptions {
  /** Maximum number of attempts (including the first). Defaults to 3. */
  readonly attempts?: number;
  /** Base delay in ms between retries. Multiplied by the attempt number. Defaults to 2000. */
  readonly delayMs?: number;
  /** Predicate that decides whether a response should be retried. Defaults to status >= 500. */
  readonly shouldRetry?: (res: Response) => boolean;
  /** Injectable HTTP transport. */
  readonly fetch: HttpFetch;
  /** Injectable timers for retry backoff. */
  readonly timers: Timers;
}

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 2_000;
const defaultShouldRetry = (res: Response): boolean => res.status >= 500;

/**
 * Wrapper around `fetch` that retries on transient failures with linear backoff.
 *
 * Network errors (thrown by `fetch`) are retried the same way as retryable responses.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init: RequestInit | undefined,
  options: FetchRetryOptions
): Promise<Response> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const fetchFn = options.fetch;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const outcome = await attemptFetch(fetchFn, input, init, shouldRetry);
    if (outcome.kind === 'response') return outcome.response;
    lastError = outcome.error;
    const isFinalAttempt = attempt >= attempts;
    if (isFinalAttempt) return finalizeOutcome(outcome);
    await sleep(delayMs * attempt, options.timers);
  }

  throw lastError;
}

function finalizeOutcome(
  outcome: Exclude<AttemptOutcome, { kind: 'response' }>
): Response {
  if (outcome.kind === 'thrown') throw outcome.error;
  return outcome.response;
}

type AttemptOutcome =
  | { kind: 'response'; response: Response }
  | { kind: 'retryable'; response: Response; error: unknown }
  | { kind: 'thrown'; error: unknown };

async function attemptFetch(
  fetchFn: HttpFetch,
  input: string | URL | Request,
  init: RequestInit | undefined,
  shouldRetry: (res: Response) => boolean
): Promise<AttemptOutcome> {
  let response: Response;
  try {
    response = await fetchFn(input, init);
  } catch (err) {
    return { kind: 'thrown', error: err };
  }
  if (!shouldRetry(response)) return { kind: 'response', response };
  return {
    kind: 'retryable',
    response,
    error: new Error(`fetchWithRetry: retryable status ${response.status}`),
  };
}

function sleep(ms: number, timers: Timers): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}
