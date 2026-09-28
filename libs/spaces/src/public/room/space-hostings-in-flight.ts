import type { Timers } from '@pkgs/clock';
import { createContext, useContext } from 'solid-js';

/** How long a room connection waits for its space's creation to land. */
const LAND_MAX_MS = 4_000;
const LAND_POLL_MS = 100;

/**
 * The spaces this device just created, each with the id of its `createSpace`
 * write, until that write has reached the server.
 *
 * The room gateway decides what someone may do in a space's room from the
 * server's rows when their socket opens (the host's game choice), and the
 * room keeps that answer for the life of the connection. A host whose space
 * is still on its way to the server must not open the socket before it
 * lands, or the room would admit them without the host's grants.
 */
export type SpaceHostingsInFlight = {
  readonly record: (spaceId: string, mutationId: string) => void;
  /** The in-flight creation of `spaceId`, if any. */
  readonly get: (spaceId: string) => string | null;
  /** The creation reached the server (or stopped being waited on). */
  readonly forget: (spaceId: string) => void;
};

export function createSpaceHostingsInFlight(): SpaceHostingsInFlight {
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

export const SpaceHostingsInFlightContext =
  createContext<SpaceHostingsInFlight | null>(null);

/** Null outside the spaces chrome (nothing is tracked there). */
export function useSpaceHostingsInFlight(): SpaceHostingsInFlight | null {
  return useContext(SpaceHostingsInFlightContext);
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
export async function hostingLanded(
  outcomes: MutationOutcomes,
  args: { readonly mutationId: string; readonly timers: Timers }
): Promise<void> {
  outcomes.wakeUploads();
  for (let waited = 0; waited < LAND_MAX_MS; waited += LAND_POLL_MS) {
    if ((await outcomes.mutationOutcome(args.mutationId)) !== 'pending') return;
    await sleep(args.timers, LAND_POLL_MS);
  }
}
