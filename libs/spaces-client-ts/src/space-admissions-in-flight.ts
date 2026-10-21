import type { Timers } from '@pkgs/clock-shared-ts/types';
import { createContext, useContext } from 'solid-js';

/** How long a room connection waits for its space participation to land. */
const LAND_MAX_MS = 4_000;
const LAND_POLL_MS = 100;

/**
 * The spaces this device created or joined, each with the id of its participation
 * write, until that write has reached the server.
 *
 * The room gateway decides what someone may do in a space's room from the
 * server's rows when their connection opens, and the
 * room keeps that answer for the life of the connection. Participation still on its way to the server must land before
 * opening that connection, so members receive their participant grants.
 */
export type SpaceAdmissionsInFlight = {
  readonly record: (spaceId: string, mutationId: string) => void;
  /** The in-flight participation of `spaceId`, if any. */
  readonly get: (spaceId: string) => string | null;
  /** The participation was confirmed or refused. */
  readonly forget: (spaceId: string) => void;
};

export function createSpaceAdmissionsInFlight(): SpaceAdmissionsInFlight {
  const inFlight = new Map<string, string>();
  return {
    record: (spaceId, mutationId) => {
      inFlight.set(spaceId, mutationId);
    },
    get: (spaceId) => inFlight.get(spaceId) ?? null,
    forget: (spaceId) => {
      inFlight.delete(spaceId);
    },
  };
}

export const SpaceAdmissionsInFlightContext =
  createContext<SpaceAdmissionsInFlight | null>(null);

/** Null outside the spaces chrome (nothing is tracked there). */
export function useSpaceAdmissionsInFlight(): SpaceAdmissionsInFlight | null {
  return useContext(SpaceAdmissionsInFlightContext);
}

type MutationOutcomes = {
  readonly mutationOutcome: (
    mutationId: string
  ) => Promise<'pending' | 'confirmed' | 'rejected'>;
  readonly wakeUploads: () => void;
};

function sleep(timers: Timers, ms: number): Promise<void> {
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

/**
 * Resolves once the write `mutationId` has reached the server (confirmed or
 * rejected), or after {@link LAND_MAX_MS} (offline: the socket will not open
 * anyway).
 */
export async function admissionLanded(
  outcomes: MutationOutcomes,
  args: { readonly mutationId: string; readonly timers: Timers }
): Promise<'pending' | 'confirmed' | 'rejected'> {
  outcomes.wakeUploads();
  for (let waited = 0; waited < LAND_MAX_MS; waited += LAND_POLL_MS) {
    const outcome = await outcomes.mutationOutcome(args.mutationId);
    if (outcome !== 'pending') return outcome;
    await sleep(args.timers, LAND_POLL_MS);
  }
  return outcomes.mutationOutcome(args.mutationId);
}
