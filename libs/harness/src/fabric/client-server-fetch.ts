import type { Clock, Timers } from '@pkgs/clock';
import { classifyHttpFetchError, HttpNetworkError } from '@pkgs/http-client';
import { createHealthOriginAvailability } from '@pkgs/http-client/origin-availability';
import type { HttpFetch } from '@pkgs/http-client/types';

/** Normalize simulated wire failures and expose health-based account recovery. */
export function harnessClientServerFetch(args: {
  readonly serverUrl: string;
  readonly fetch: HttpFetch;
  readonly clock: Clock;
  readonly timers: Timers;
}) {
  const availability = createHealthOriginAvailability({
    healthUrl: `${args.serverUrl}/api/health`,
    fetch: args.fetch,
    clock: args.clock,
    timers: args.timers,
  });
  return {
    availability,
    fetch: (async (input, init?: RequestInit) => {
      try {
        return await args.fetch(input, init);
      } catch (cause) {
        const error = classifyHttpFetchError(cause);
        if (error instanceof HttpNetworkError)
          availability.noteNetworkFailure();
        throw error;
      }
    }) satisfies HttpFetch,
  };
}
