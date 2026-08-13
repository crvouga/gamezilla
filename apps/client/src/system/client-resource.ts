/**
 * Product `client` resource implement — {@link createClientApp} + injected Driver launch.
 *
 * RNTL / Jest mounting stays in `@test/ui`; this module only wires graph deps
 * into a {@link ClientApp} and delegates Driver creation.
 */

import type { AppOverrides } from '@apps/client/providers/app-overrides';
import { createClientApp } from '@apps/client/providers/create-client-app';
import { client } from '@libs/runtime/shared/system';
import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { Io } from '@pkgs/io';
import type { ResourceCtx, ResourceImpl } from '@pkgs/system';
import type { Driver } from '@pkgs/ui-testing';

export type ClientResourceLaunchArgs = {
  readonly deps: {
    readonly api: (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => Promise<Response>;
    readonly events: unknown;
    readonly db: unknown;
    readonly kv: unknown;
    readonly room: unknown;
    readonly sentry: unknown;
  };
  readonly ctx: ResourceCtx;
  readonly app: ReturnType<typeof createClientApp>;
  readonly http: HttpClient;
};

export type CreateClientResourceArgs = {
  readonly buildOverrides: (args: {
    readonly deps: ClientResourceLaunchArgs['deps'];
    readonly ctx: ResourceCtx;
    readonly apiUrl: string;
  }) => AppOverrides;
  readonly launchDriver: (args: ClientResourceLaunchArgs) => Promise<Driver>;
  readonly apiUrl?: string;
  readonly timers?: Timers;
};

const DEFAULT_API_URL = 'http://sim.local';

function buildActorIo(
  ctx: ResourceCtx,
  http: HttpClient,
  timers: Timers | undefined
): Io {
  let idSeq = 0;
  return {
    clock: {
      now: () => ctx.clock.now(),
    },
    timers: timers ?? {
      setTimeout: () => {
        throw new Error('createClientResource: timers required');
      },
      clearTimeout: () => {},
      setInterval: () => {
        throw new Error('createClientResource: timers required');
      },
      clearInterval: () => {},
    },
    createId: () => {
      idSeq += 1;
      return `00000000-0000-4000-8000-${String(idSeq).padStart(12, '0')}`;
    },
    random: ctx.random,
    http,
    seed: 1n,
  };
}

/**
 * `client.implement<Driver>` using real {@link createClientApp}.
 * Callers supply AppOverrides + Driver launch (RNTL lives in `@test/ui`).
 */
export function createClientResource(
  args: CreateClientResourceArgs
): ResourceImpl<unknown, Driver> {
  const apiUrl = args.apiUrl ?? DEFAULT_API_URL;
  return client.implement<Driver>(async (deps, ctx) => {
    const http: HttpClient = {
      fetch: (input, init) => deps.api(input, init),
    };
    const overrides = args.buildOverrides({ deps, ctx, apiUrl });
    const app = createClientApp({
      io: buildActorIo(ctx, http, args.timers),
      overrides,
    });
    return args.launchDriver({ deps, ctx, app, http });
  });
}
