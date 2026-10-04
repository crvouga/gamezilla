import { expect, test } from 'bun:test';
import { MatchmakingDevice } from '@pkgs/matchmaking-shared/device';
import type { CurrentSearch } from '@pkgs/matchmaking-shared/identity';
import type { Matchmaking } from '@pkgs/matchmaking-shared/matchmaking';

function transport() {
  const pending: ((value: CurrentSearch | null) => void)[] = [];
  const port: Pick<
    Matchmaking,
    'join' | 'leave' | 'updateFormulas' | 'current'
  > = {
    join: async () => {
      throw new Error('unexpected begin');
    },
    leave: async () => {
      throw new Error('unexpected stop');
    },
    updateFormulas: async () => {
      throw new Error('unexpected change');
    },
    current: () => new Promise((resolve) => pending.push(resolve)),
  };
  return {
    pending,
    device: new MatchmakingDevice('alice', { matchmaking: () => port }),
  };
}

const waiting: CurrentSearch = {
  participantId: '["alice","begin-1"]',
  joinedAtMs: 0,
  observedAtMs: 0,
  formulas: [],
  result: { status: 'waiting', data: {}, metadata: null },
};

// regression: matchmaking-delayed-view-overwrites-offline
// The network response was sent before connection loss, but arrives afterwards.
test('a response arriving after connection loss cannot change the offline view', async () => {
  const { device, pending } = transport();
  const read = device.refresh();
  await device.setConnected(false);
  pending[0]!(waiting);
  await read;
  expect(device.view()).toBeNull();
});

// regression: matchmaking-delayed-view-overwrites-newer
// The earlier waiting response arrives after an acknowledged stopped response.
test('an older response cannot overwrite a newer accepted view', async () => {
  const { device, pending } = transport();
  const earlier = device.refresh();
  const newer = device.refresh();
  pending[1]!(null);
  await newer;
  pending[0]!(waiting);
  await earlier;
  expect(device.view()).toBeNull();
});
