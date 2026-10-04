/**
 * Port types for `@pkgs/matchmaking`.
 *
 * Adapters (`impl-sql`, …) implement {@link Matchmaking}.
 * Composition roots construct a concrete adapter; app code and contract
 * tests depend only on this port.
 */

import type { AttributeState } from '@pkgs/attribute-shared/attribute';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import type { FormulaWire } from './formula-wire';
import type { CurrentSearch, OwnerRequest, SearchRequest } from './identity';
import type { MatchmakingSchema } from './schema';
import type {
  DistanceFormula,
  JoinInput,
  JoinResult,
  LeaveResult,
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
} from './types';

export type MatchmakingTuning = {
  /**
   * Required clock (epoch ms). Bound into join/pass/sweep — never
   * omitted. Tests inject a mutable ref for simulated time.
   */
  readonly now: () => number;
  /**
   * Required id mint for waiting-row ids and match ids.
   */
  readonly createId: () => string;
  readonly maxPairsPerPass?: number;
};

/**
 * Shared, storage-agnostic boot config. Adapters add their own
 * storage fields (e.g. `sqlClient` on the SQL adapter).
 */
export type MatchmakingConfig = {
  readonly schema: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning: MatchmakingTuning;
};

export type MatchmakingAppOptions = {
  readonly requireAuth: MiddlewareHandler;
  readonly ownerId: (context: Context) => string;
};

export type TickOptions = {
  readonly maxPartitions?: number;
  readonly maxPassesPerPartition?: number;
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
};

export type TickResult = {
  readonly matches: number;
  readonly passes: number;
  readonly partitions: number;
};

/** HTTP / wire join body (formulas as plain JSON paths). */
export type JoinInputRaw = OwnerRequest & {
  readonly data: AttributeState;
  readonly formulas: readonly FormulaWire[];
  readonly groupSize?: number;
  readonly metadata?: Record<string, unknown> | null;
};

export type UpdateFormulasInputRaw = {
  readonly formulas: readonly FormulaWire[];
};

/**
 * Storage-agnostic matchmaking service. Six public operations plus
 * wire-shaped join/update helpers used by the shared HTTP app.
 */
export type Matchmaking = {
  ready(): Promise<void>;
  join(input: JoinInput): Promise<JoinResult>;
  /** Wire-shaped join used by the HTTP `/join` route. */
  joinRaw(input: JoinInputRaw): Promise<JoinResult>;
  leave(input: SearchRequest): Promise<LeaveResult>;
  status(ownerId: string, participantId: string): Promise<StatusResult | null>;
  current(ownerId: string): Promise<CurrentSearch | null>;
  setAvailable(ownerId: string, available: boolean): Promise<void>;
  setRestriction(
    ownerA: string,
    ownerB: string,
    restricted: boolean
  ): Promise<void>;
  canPair(ownerA: string, ownerB: string): Promise<boolean>;
  updateFormulas(
    input: SearchRequest,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult>;
  /** Wire-shaped update used by the HTTP `/update-formulas` route. */
  updateFormulasRaw(
    request: SearchRequest,
    input: UpdateFormulasInputRaw
  ): Promise<UpdateFormulasResult>;
  app(opts: MatchmakingAppOptions): Hono;
  tick(opts?: TickOptions): Promise<TickResult>;
};
