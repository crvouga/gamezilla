import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { classifyHttpFetchError } from '@pkgs/http-client-shared-ts/errors';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import { createHealthOriginAvailability } from '@pkgs/http-client-shared-ts/origin-availability';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';

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
