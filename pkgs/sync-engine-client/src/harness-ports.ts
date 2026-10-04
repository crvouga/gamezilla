/**
 * Injectable nondeterminism type aliases for sync-engine.
 * Call sites must pass now/timers/createId — no wall fallbacks.
 */

import type { Clock } from '@pkgs/clock-shared/types';
import type { Random } from '@pkgs/uuid-shared/create-id';
export type SyncClock = Clock;
export type SyncRandom = { readonly random: Random };
