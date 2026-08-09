/**
 * Injectable nondeterminism boundaries for deterministic simulation.
 * Re-exports shared ports from `@pkgs/clock` / `@pkgs/uuid` and keeps
 * sync-engine-named aliases for existing call sites.
 */

import type { Clock, Timers } from '@pkgs/clock';
import { resolveNow, resolveTimers, wallClock, wallTimers } from '@pkgs/clock';
import type { CreateId, Random } from '@pkgs/uuid';
import { resolveCreateId, resolveRandom } from '@pkgs/uuid';

export type { CreateId, Timers };
export type SyncClock = Clock;
export type SyncRandom = { readonly random: Random };

/** @deprecated Prefer `wallTimers` from `@pkgs/clock` — kept for sync call sites. */
export const REAL_TIMERS: Timers = wallTimers;

export { resolveCreateId, resolveNow, resolveRandom, resolveTimers };

export function resolveClock(override?: Clock): Clock {
  return override ?? wallClock;
}
