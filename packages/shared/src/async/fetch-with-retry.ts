export interface FetchRetryOptions {
  /** Maximum number of attempts (including the first). Defaults to 3. */
  readonly attempts?: number;
  /** Base delay in ms between retries. Multiplied by the attempt number. Defaults to 2000. */
  readonly delayMs?: number;
  /** Predicate that decides whether a response should be retried. Defaults to status >= 500. */
  readonly shouldRetry?: (res: Response) => boolean;
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
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  const attempts = options?.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const shouldRetry = options?.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(input, init);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await sleep(delayMs * attempt);
        continue;
      }
      throw err;
    }

    if (!shouldRetry(res) || attempt >= attempts) return res;
    await sleep(delayMs * attempt);
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
