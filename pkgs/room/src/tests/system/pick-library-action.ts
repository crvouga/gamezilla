import type { SeededRng } from '@pkgs/uuid';

import type { RoomApp, RoomSystemAction } from '../../sim/system';

type FuzzState = {
  sessionConnected: Set<string>;
  crashed: Set<string>;
  serverCrashed: boolean;
};

type LiveSets = {
  readonly live: readonly string[];
  readonly crashed: readonly string[];
  readonly connected: readonly string[];
  readonly disconnected: readonly string[];
};

function liveSets(ids: readonly string[], st: FuzzState): LiveSets {
  return {
    live: ids.filter(
      (id) =>
        st.sessionConnected.has(id) && !st.crashed.has(id) && !st.serverCrashed
    ),
    crashed: ids.filter((id) => st.crashed.has(id)),
    connected: ids.filter(
      (id) => st.sessionConnected.has(id) && !st.crashed.has(id)
    ),
    disconnected: ids.filter(
      (id) => !st.sessionConnected.has(id) && !st.crashed.has(id)
    ),
  };
}

function pickOrIdle(
  ids: readonly string[],
  rng: SeededRng,
  build: (clientId: string) => RoomSystemAction
): RoomSystemAction {
  if (ids.length === 0) return { kind: 'idle', ms: 1 + rng.int(40) };
  return build(ids[rng.int(ids.length)]!);
}

function pickSessionAction(
  rng: SeededRng,
  st: FuzzState,
  sets: LiveSets,
  roll: number
): RoomSystemAction | null {
  if (roll < 0.76) {
    return pickOrIdle(sets.connected, rng, (clientId) => {
      st.sessionConnected.delete(clientId);
      return { kind: 'disconnect', clientId };
    });
  }
  if (roll < 0.82) {
    return pickOrIdle(sets.disconnected, rng, (clientId) => {
      st.sessionConnected.add(clientId);
      return { kind: 'connect', clientId };
    });
  }
  if (roll < 0.86) {
    return pickOrIdle(sets.live, rng, (clientId) => ({
      kind: 'takeOver',
      clientId,
    }));
  }
  return null;
}

function pickLifecycleAction(
  rng: SeededRng,
  st: FuzzState,
  sets: LiveSets,
  roll: number
): RoomSystemAction {
  if (roll < 0.9) {
    return pickOrIdle(sets.connected, rng, (clientId) => {
      st.crashed.add(clientId);
      st.sessionConnected.delete(clientId);
      return { kind: 'crash', clientId };
    });
  }
  if (roll < 0.93) {
    return pickOrIdle(sets.crashed, rng, (clientId) => {
      st.crashed.delete(clientId);
      st.sessionConnected.add(clientId);
      return { kind: 'restart', clientId };
    });
  }
  if (roll < 0.95 && !st.serverCrashed) {
    st.serverCrashed = true;
    return { kind: 'serverCrash' };
  }
  if (roll < 0.97 && st.serverCrashed) {
    st.serverCrashed = false;
    return { kind: 'serverRestart' };
  }
  return { kind: 'idle', ms: 1 + rng.int(40) };
}

/**
 * Percentile picker for seeded non-shrinking fuzz (`runRoomSeed`).
 * Tracks a tiny model so illegal pairs are not emitted. Boundary arms omitted.
 */
export function pickRoomSystemAction(
  rng: SeededRng,
  clientIds: readonly string[],
  pickDomain: RoomApp['pickDomainOp'],
  state?: FuzzState
): RoomSystemAction {
  const ids = clientIds.length > 0 ? clientIds : ['c0'];
  const st: FuzzState = state ?? createFuzzState(ids);
  const sets = liveSets(ids, st);
  const roll = rng.random();

  if (roll < 0.5 && sets.live.length > 0) {
    return pickDomain(rng, sets.live);
  }
  if (roll < 0.58) {
    return pickOrIdle(sets.connected, rng, (clientId) => ({
      kind: 'hold',
      clientId,
    }));
  }
  if (roll < 0.64) {
    return pickOrIdle(sets.connected, rng, (clientId) => ({
      kind: 'down',
      clientId,
    }));
  }
  if (roll < 0.7) return { kind: 'heal' };

  const session = pickSessionAction(rng, st, sets, roll);
  if (session !== null) return session;
  return pickLifecycleAction(rng, st, sets, roll);
}

/** Create mutable fuzz state for {@link pickRoomSystemAction}. */
export function createFuzzState(clientIds: readonly string[]): FuzzState {
  return {
    sessionConnected: new Set(clientIds),
    crashed: new Set(),
    serverCrashed: false,
  };
}
