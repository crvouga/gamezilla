/**
 * How long the server takes to get a device's account ready after a sign-in
 * (`POST /identity/refresh`). In production that takes seconds; the harness
 * answers it at once unless a scenario slows it for one device, so the gap
 * between "the provider said yes" and "the account is ready" can be acted in.
 * The delay belongs to the device, so it outlives an app restart.
 */

import type { ServerHttp } from '@libs/sub-shared/sync';
import type { Timers } from '@pkgs/clock-shared/types';

import { requestPath } from './http-request';

const IDENTITY_REFRESH_PATH = '/api/identity/refresh';

export type HarnessAccountReadyDelays = {
  readonly set: (clientId: string, delayMs: number) => void;
  readonly wait: (
    clientId: string,
    token: string,
    timers: Timers
  ) => Promise<void>;
};

export function createHarnessAccountReadyDelays(): HarnessAccountReadyDelays {
  const delays = new Map<string, number>();
  const ready = new Map<string, Map<string, Promise<void>>>();
  return {
    set: (clientId, delayMs) => {
      ready.delete(clientId);
      if (delayMs > 0) delays.set(clientId, delayMs);
      else delays.delete(clientId);
    },
    wait: (clientId, token, timers) => {
      const delayMs = delays.get(clientId) ?? 0;
      if (delayMs === 0) return Promise.resolve();
      let accounts = ready.get(clientId);
      if (accounts === undefined) {
        accounts = new Map();
        ready.set(clientId, accounts);
      }
      let pending = accounts.get(token);
      if (pending === undefined) {
        pending = new Promise<void>((resolve) => {
          timers.setTimeout(resolve, delayMs);
        });
        accounts.set(token, pending);
      }
      return pending;
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
    if (requestPath(input).endsWith(IDENTITY_REFRESH_PATH)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      await delays.wait(clientId, headers.get('authorization') ?? '', timers);
    }
    return inner(input, init);
  };
}
