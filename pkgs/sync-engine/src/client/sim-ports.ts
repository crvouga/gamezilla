/**
 * Injectable nondeterminism type aliases for sync-engine.
 * Call sites must pass now/timers/createId — no wall fallbacks.
 */

import type { Clock, Timers } from '@pkgs/clock';
import type { CreateId, Random } from '@pkgs/uuid';

export type { CreateId, Timers };
export type SyncClock = Clock;
export type SyncRandom = { readonly random: Random };
