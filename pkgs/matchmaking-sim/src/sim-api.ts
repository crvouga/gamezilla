/**
 * Public types for the matchmaking deterministic simulator.
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
export type MatchmakingSimBackend = 'sqlite' | 'postgres';

export type SimParticipant = {
  readonly participantId: string;
  readonly joinedOn: string;
  readonly status: (replicaId?: string) => Promise<StatusResult | null>;
  readonly leave: (replicaId?: string) => Promise<LeaveResult>;
  readonly updateFormulas: (
    formulas: readonly DistanceFormula[],
    replicaId?: string
  ) => Promise<UpdateFormulasResult>;
};

export type SimReplica = {
  readonly id: string;
  readonly mm: Matchmaking;
  readonly join: (input: JoinInput) => Promise<SimParticipant>;
  readonly tick: (opts?: TickOptions) => Promise<TickResult>;
};

/** Kit methods on the matchmaking surface. */
export type MatchmakingSimRuntime = {
  readonly replicas: ReadonlyMap<string, SimReplica>;
  readonly replica: (id: string) => SimReplica;
  readonly addReplica: (id: string) => Promise<SimReplica>;
  /** Convenience: first replica's Matchmaking port. */
  readonly mm: Matchmaking;
  readonly join: (
    input: JoinInput,
    replicaId?: string
  ) => Promise<SimParticipant>;
  readonly tick: (
    opts?: TickOptions,
    replicaId?: string
  ) => Promise<TickResult>;
  readonly tickAll: (opts?: TickOptions) => Promise<readonly TickResult[]>;
};
