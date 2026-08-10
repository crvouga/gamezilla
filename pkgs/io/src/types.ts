import type { Clock, Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { CreateId, Random } from '@pkgs/uuid';

/**
 * Single injectable bag for all nondeterministic I/O.
 * Composition roots construct one {@link Io} (wall or sim) and pass it down.
 */
export type Io = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly random: Random;
  readonly http: HttpClient;
  /** Process / simulation seed (wallIo mints once on first access). */
  readonly seed: bigint;
};
