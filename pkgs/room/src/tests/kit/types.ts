import type { SeededRng } from '@pkgs/io';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';

export type GenCtx<S extends RoomState> = {
  readonly rng: SeededRng;
  readonly state: S;
  readonly identity: string;
  readonly now: number;
  readonly step: number;
};

export type ModuleConformanceArgs<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly module: RoomModule<S, C, E, string>;
  readonly seed: number | bigint | string;
  /** Seeded command generator; return null to skip. */
  readonly generateCommand: (ctx: GenCtx<S>) => C | null;
  readonly identities?: readonly string[];
  readonly isValidState: (state: S) => boolean;
  readonly isTerminal?: (state: S) => boolean;
  readonly outcomeId?: (state: S) => string | null;
  readonly deadlineMs?: (state: S, now: number) => number | null;
  /** Engine fuzz steps (default 24). */
  readonly fuzzSteps?: number;
  readonly mildFaults?: boolean;
};
