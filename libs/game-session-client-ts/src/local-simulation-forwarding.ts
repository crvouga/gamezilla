import type { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import type { SpaceOpenRoomEntry } from '@libs/spaces-client-ts/space-open-rooms-store';

/** Sharing is transient on the room already owned by this screen; offline play keeps running. */
export function forwardLocalSimulation(
  local: LocalSimulationSession,
  room: SpaceOpenRoomEntry['room']
): () => void {
  const snapshots = local.subscribe((message) => {
    if (SimulationStateChanged.is(message)) room.sendSignal(message);
  });
  const requests = room.subscribeSignal((message) => {
    if (RequestSimulationSnapshot.is(message)) local.send(message);
  });
  return () => {
    snapshots();
    requests();
  };
}
