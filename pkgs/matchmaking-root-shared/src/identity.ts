import type { FormulaWire } from './formula-wire';
import type { StatusResult } from './types';

/** Trusted owner supplied by the authenticated composition root. */
export type OwnerRequest = {
  readonly ownerId: string;
  readonly requestId: string;
};

export type SearchRequest = OwnerRequest & {
  readonly participantId: string;
};

/** The same logical begin has the same owned identity on every replica. */
export function searchIdFor(ownerId: string, requestId: string): string {
  return JSON.stringify([ownerId, requestId]);
}

/** The latest accepted search, including an ended search's frozen range. */
export type CurrentSearch = {
  readonly participantId: string;
  readonly joinedAtMs: number;
  readonly observedAtMs: number;
  readonly formulas: readonly FormulaWire[];
  readonly result: StatusResult | null;
};
