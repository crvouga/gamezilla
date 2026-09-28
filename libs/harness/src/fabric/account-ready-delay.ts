/**
 * How long the server takes to get a device's account ready after a sign-in
 * (`POST /identity/refresh`). In production that takes seconds; the harness
 * answers it at once unless a scenario slows it for one device, so the gap
 * between "the provider said yes" and "the account is ready" can be acted in.
 * The delay belongs to the device, so it outlives an app restart.
 */

import type { ServerHttp } from '@libs/client-app/shell/client-env';
import type { Timers } from '@pkgs/clock';

import { requestPath } from './http-request';

const IDENTITY_REFRESH_PATH = '/api/identity/refresh';

export type HarnessAccountReadyDelays = {
  readonly of: (clientId: string) => number;
  readonly set: (clientId: string, delayMs: number) => void;
};

export function createHarnessAccountReadyDelays(): HarnessAccountReadyDelays {
  const delays = new Map<string, number>();
  return {
    of: (clientId) => delays.get(clientId) ?? 0,
    set: (clientId, delayMs) => {
      if (delayMs > 0) delays.set(clientId, delayMs);
      else delays.delete(clientId);
    },
  };
}

/** `clientId`'s server HTTP, its identity refresh held for its delay. */
export function accountReadyDelayFetch(args: {
  readonly delays: HarnessAccountReadyDelays;
  readonly clientId: string;
  readonly timers: Timers;
  readonly inner: ServerHttp;
}): ServerHttp {
  const { delays, clientId, timers, inner } = args;
  return async (input, init) => {
    const delayMs = delays.of(clientId);
    if (delayMs > 0 && requestPath(input).endsWith(IDENTITY_REFRESH_PATH)) {
      await new Promise<void>((resolve) => {
        timers.setTimeout(resolve, delayMs);
      });
    }
    return inner(input, init);
  };
}
