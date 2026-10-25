import { expect } from 'bun:test';
import type { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import {
  RequestSimulationSnapshot,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import { WebClientStorage } from '@pkgs/room-adapter-web-shared-ts/client-storage';

export function localByteStorage(bytes: Map<string, string>) {
  return new WebClientStorage('local-race', {
    getItem: (key) => bytes.get(key) ?? null,
    setItem: (key, value) => {
      bytes.set(key, value);
    },
    removeItem: (key) => {
      bytes.delete(key);
    },
  });
}

export async function requestLocalState(local: LocalSimulationSession) {
  let frame: SimulationSnapshotPayload | null = null;
  const unsubscribe = local.subscribe((message) => {
    if (SimulationStateChanged.is(message)) frame = message.payload;
  });
  expect(local.send(RequestSimulationSnapshot({ version: 1 }))).not.toBeNull();
  await local.flush();
  unsubscribe();
  if (frame === null) throw new Error('no published local court');
  return frame as SimulationSnapshotPayload;
}
