/**
 * Public types for the matchmaking deterministic simulator.
 */

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

/** Kit methods merged onto the framework world via `extend`. */
export type MatchmakingSimKit = {
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
  readonly waitUntil: (
    target: UntilTarget,
    opts?: UntilOpts
  ) => Promise<number>;
  readonly waitNever: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
};

/** Opened matchmaking world: framework controls + {@link MatchmakingSimKit}. */
export type MatchmakingSimWorld = MatchmakingSimKit;
