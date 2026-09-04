import type { SeededRng } from '@pkgs/uuid';

import type { RoomDstAction } from './actions';
import type { RoomDstApp } from './app';

type FuzzState = {
  sessionConnected: Set<string>;
  crashed: Set<string>;
  serverCrashed: boolean;
};

/**
 * Percentile picker for seeded non-shrinking fuzz (`runRoomSeed`).
 * Tracks a tiny model so illegal pairs (restart without crash, domain on
 * crashed client) are not emitted.
 */
export function pickRoomDstAction(
  rng: SeededRng,
  clientIds: readonly string[],
  pickDomain: RoomDstApp['pickDomainOp'],
  state?: FuzzState
): RoomDstAction {
  const ids = clientIds.length > 0 ? clientIds : ['c0'];
  const st: FuzzState = state ?? {
    sessionConnected: new Set(ids),
    crashed: new Set(),
    serverCrashed: false,
  };
  const live = ids.filter(
    (id) =>
      st.sessionConnected.has(id) && !st.crashed.has(id) && !st.serverCrashed
  );
  const crashed = ids.filter((id) => st.crashed.has(id));
  const connected = ids.filter(
    (id) => st.sessionConnected.has(id) && !st.crashed.has(id)
  );
  const disconnected = ids.filter(
    (id) => !st.sessionConnected.has(id) && !st.crashed.has(id)
  );

  const roll = rng.random();
  let action: RoomDstAction;

  if (roll < 0.5 && live.length > 0) {
    action = pickDomain(rng, live);
  } else if (roll < 0.58 && connected.length > 0) {
    const clientId = connected[rng.int(connected.length)]!;
    action = { kind: 'hold', clientId };
  } else if (roll < 0.64 && connected.length > 0) {
    const clientId = connected[rng.int(connected.length)]!;
    action = { kind: 'down', clientId };
  } else if (roll < 0.7) {
    action = { kind: 'heal' };
  } else if (roll < 0.76 && connected.length > 0) {
    const clientId = connected[rng.int(connected.length)]!;
    action = { kind: 'disconnect', clientId };
    st.sessionConnected.delete(clientId);
  } else if (roll < 0.82 && disconnected.length > 0) {
    const clientId = disconnected[rng.int(disconnected.length)]!;
    action = { kind: 'connect', clientId };
    st.sessionConnected.add(clientId);
  } else if (roll < 0.86 && live.length > 0) {
    const clientId = live[rng.int(live.length)]!;
    action = { kind: 'takeOver', clientId };
  } else if (roll < 0.9 && connected.length > 0) {
    const clientId = connected[rng.int(connected.length)]!;
    action = { kind: 'crash', clientId };
    st.crashed.add(clientId);
    st.sessionConnected.delete(clientId);
  } else if (roll < 0.93 && crashed.length > 0) {
    const clientId = crashed[rng.int(crashed.length)]!;
    action = { kind: 'restart', clientId };
    st.crashed.delete(clientId);
    st.sessionConnected.add(clientId);
  } else if (roll < 0.95 && !st.serverCrashed) {
    action = { kind: 'serverCrash' };
    st.serverCrashed = true;
  } else if (roll < 0.97 && st.serverCrashed) {
    action = { kind: 'serverRestart' };
    st.serverCrashed = false;
  } else {
    action = { kind: 'idle', ms: 1 + rng.int(40) };
  }

  return action;
}

/** Create mutable fuzz state for {@link pickRoomDstAction}. */
export function createFuzzState(clientIds: readonly string[]): FuzzState {
  return {
    sessionConnected: new Set(clientIds),
    crashed: new Set(),
    serverCrashed: false,
  };
}
