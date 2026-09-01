/**
 * Public types for the matchmaking deterministic simulator.
 */

import type { SimClock } from '@pkgs/determinism';
import type { SeededRng } from '@pkgs/uuid';
import type {
  Matchmaking,
  TickOptions,
  TickResult,
} from '../interface/matchmaking';
import type {
  DistanceFormula,
  JoinInput,
  LeaveResult,
  StatusResult,
  UpdateFormulasResult,
} from '../interface/types';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';

export type MatchmakingSimBackend = 'sqlite' | 'postgres';

export type ParticipantHandle = {
  readonly participantId: string;
  readonly joinedOn: string;
  readonly status: (replicaId?: string) => Promise<StatusResult | null>;
  readonly leave: (replicaId?: string) => Promise<LeaveResult>;
  readonly updateFormulas: (
    formulas: readonly DistanceFormula[],
    replicaId?: string
  ) => Promise<UpdateFormulasResult>;
};

export type ReplicaHandle = {
  readonly id: string;
  readonly mm: Matchmaking;
  readonly join: (input: JoinInput) => Promise<ParticipantHandle>;
  readonly tick: (opts?: TickOptions) => Promise<TickResult>;
};

export type MatchmakingSimWorld = {
  readonly seed: bigint;
  readonly rng: SeededRng;
  readonly clock: SimClock;
  readonly replicas: ReadonlyMap<string, ReplicaHandle>;
  readonly replica: (id: string) => ReplicaHandle;
  readonly addReplica: (id: string) => Promise<ReplicaHandle>;
  /** Convenience: first replica's Matchmaking port. */
  readonly mm: Matchmaking;
  readonly join: (
    input: JoinInput,
    replicaId?: string
  ) => Promise<ParticipantHandle>;
  readonly tick: (
    opts?: TickOptions,
    replicaId?: string
  ) => Promise<TickResult>;
  readonly tickAll: (opts?: TickOptions) => Promise<readonly TickResult[]>;
  readonly runFor: (ms: number) => Promise<void>;
  readonly until: (target: UntilTarget, opts?: UntilOpts) => Promise<number>;
  readonly never: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};
