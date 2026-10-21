import { classifyHttpFetchError } from './errors';
import { HttpAbortError } from './http-abort-error';
import { HttpNetworkError } from './http-network-error';
import type { OriginAvailability } from './origin-availability';
import { requestHref } from './origin-href';
import type { HttpFetch } from './types';

/**
 * Fail an interactive origin request immediately while it is unavailable.
 * Background owners may explicitly wait on OriginAvailability; the request
 * itself is never retained for execution after the caller has moved on.
 */
export function createOriginAwareFetch(args: {
  readonly fetch: HttpFetch;
  readonly availability: OriginAvailability;
}): HttpFetch {
  const inner = args.fetch;
  const availability = args.availability;
  return async (input, init) => {
    const href = requestHref(input);
    if (shouldBypassGate(availability, href)) {
      return inner(input, init);
    }
    const signal =
      init?.signal ?? (input instanceof Request ? input.signal : null);
    if (signal?.aborted) throw new HttpAbortError();
    if (availability.getSnapshot().phase !== 'available') {
      throw new HttpNetworkError('The connection is currently unavailable.');
    }
    return fetchAndNote(inner, availability, input, init);
  };
}

function shouldBypassGate(
  availability: OriginAvailability,
  href: string
): boolean {
  return (
    availability.isHealthProbeUrl(href) || !availability.matchesOrigin(href)
  );
}

async function fetchAndNote(
  inner: HttpFetch,
  availability: OriginAvailability,
  input: RequestInfo | URL,
  init: RequestInit | undefined
): Promise<Response> {
  try {
    const response = await inner(input, init);
    availability.noteSuccess();
    return response;
  } catch (err) {
    const classified = classifyHttpFetchError(err);
    if (classified instanceof HttpNetworkError) {
      availability.noteNetworkFailure();
    }
    throw classified;
  }
}
