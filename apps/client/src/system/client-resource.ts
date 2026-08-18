/**
 * Helpers for DST client composition — Io from ResourceCtx + App props.
 * Driver / RNTL mounting lives in `@test/system`.
 */

import type { ClientSystemResources } from '@apps/client/providers/client-system-resources';
import type { Io } from '@pkgs/io';
import type { ResourceCtx } from '@pkgs/system';

export function ioFromResourceCtx(
  ctx: ResourceCtx,
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Io {
  return {
    clock: { now: () => ctx.clock.now() },
    timers: ctx.timers,
    createId: ctx.createId,
    random: ctx.random,
    http: { fetch },
    seed: ctx.seed,
  };
}

export type ClientAppMountProps = {
  readonly io: Io;
  readonly resources: ClientSystemResources;
};
