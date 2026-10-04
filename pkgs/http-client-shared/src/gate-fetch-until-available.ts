import { classifyHttpFetchError } from './errors';
import { HttpNetworkError } from './http-network-error';
import type { OriginAvailability } from './origin-availability';
import { requestHref } from './origin-href';
import type { HttpFetch } from './types';

/**
 * Park origin fetches until {@link OriginAvailability} is available.
 * The health probe URL always bypasses the gate.
 */
export function gateFetchUntilAvailable(args: {
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
    await availability.waitUntilAvailable(init?.signal);
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
