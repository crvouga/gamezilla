/**
 * Public types for the matchmaking deterministic simulator.
 */

import type { SimClock, SimIo } from '@pkgs/io';
import type {
  Matchmaking,
  MatchmakingTuning,
  TickOptions,
  TickResult,
} from '../interface/matchmaking';
import type { MatchmakingSchema } from '../interface/schema';
import type {
  DistanceFormula,
  JoinInput,
  LeaveResult,
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
} from '../interface/types';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';

export type MatchmakingSimBackend = 'sqlite' | 'postgres';

export type OpenMatchmakingSimWorldArgs = {
  readonly seed: number | bigint | string;
  /** Number of replicas sharing one DB. Default 1. */
  readonly replicas?: number;
  /** Default sqlite. Use postgres for concurrent tickAll claim races. */
  readonly backend?: MatchmakingSimBackend;
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: Partial<MatchmakingTuning>;
  readonly startMs?: number;
};

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
  readonly io: SimIo;
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
