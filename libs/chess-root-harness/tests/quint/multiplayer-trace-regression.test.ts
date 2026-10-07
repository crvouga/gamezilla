import './index';
import { expect, test } from 'bun:test';
import { decodeItfTrace } from '@pkgs/quint-shared/itf';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import { replayTrace } from '@pkgs/quint-shared/replay';
import deletionTrace from './fixtures/multiplayer-third-device-deletion.itf.json';

// regression: chess-deletion-refreshes-connected-devices
test('Carol’s third-device deletion clears her devices while Alice’s offline computer keeps its board', async () => {
  const binding = quintBinding('multiplayer');
  const result = await replayTrace({
    ctx: {
      packageName: '@libs/chess',
      specUri: 'specs/chess/multiplayer.qnt',
      model: binding.model,
      trace: 1,
      seed: '0x67932',
      testId: 'multiplayer.deletion-regression',
      title: 'Third-device deletion with an offline opponent',
    },
    trace: decodeItfTrace(deletionTrace),
    world: quintWorld(),
    binding,
  });
  expect(result).not.toBeNull();
}, 120_000);
