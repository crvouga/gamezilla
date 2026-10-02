import type { EnvTime } from '@libs/feature/public/sync';

/**
 * Layer A bag for `@apps/server` — wall DO and harness in-process inject
 * different implementations. Same `EnvTime` core as ClientEnv / ServerEnv.
 */
export type RoomServerEnv = EnvTime;
