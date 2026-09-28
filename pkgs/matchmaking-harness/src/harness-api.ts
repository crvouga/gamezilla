/**
 * Public types for the matchmaking deterministic harness.
 */

import type {
  DistanceFormula,
  JoinInput,
  LeaveResult,
  Matchmaking,
  StatusResult,
  TickOptions,
  TickResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
export type MatchmakingHarnessBackend = 'sqlite' | 'postgres';

export type HarnessParticipant = {
  readonly participantId: string;
  readonly joinedOn: string;
  readonly status: (replicaId?: string) => Promise<StatusResult | null>;
  readonly leave: (replicaId?: string) => Promise<LeaveResult>;
  readonly updateFormulas: (
    formulas: readonly DistanceFormula[],
    replicaId?: string
  ) => Promise<UpdateFormulasResult>;
};

export type HarnessReplica = {
  readonly id: string;
  readonly mm: Matchmaking;
  readonly join: (input: JoinInput) => Promise<HarnessParticipant>;
  readonly tick: (opts?: TickOptions) => Promise<TickResult>;
};

/** Kit methods on the matchmaking surface. */
export type MatchmakingHarnessRuntime = {
  readonly replicas: ReadonlyMap<string, HarnessReplica>;
  readonly replica: (id: string) => HarnessReplica;
  readonly addReplica: (id: string) => Promise<HarnessReplica>;
  /** Convenience: first replica's Matchmaking port. */
  readonly mm: Matchmaking;
  readonly join: (
    input: JoinInput,
    replicaId?: string
  ) => Promise<HarnessParticipant>;
  readonly tick: (
    opts?: TickOptions,
    replicaId?: string
  ) => Promise<TickResult>;
  readonly tickAll: (opts?: TickOptions) => Promise<readonly TickResult[]>;
};
