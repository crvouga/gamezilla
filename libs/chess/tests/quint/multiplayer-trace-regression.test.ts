import './index';
import { expect, test } from 'bun:test';
import { decodeItfTrace } from '@pkgs/quint/itf';
import { quintBinding, quintWorld } from '@pkgs/quint/registry';
import { replayTrace } from '@pkgs/quint/replay';
import deletionTrace from './fixtures/multiplayer-third-device-deletion.itf.json';

// regression: chess-deletion-refreshes-connected-devices
test('CI trace 115 clears Dave’s connected devices after his third-device deletion', async () => {
  const binding = quintBinding('multiplayer');
  const result = await replayTrace({
    ctx: {
      packageName: '@libs/chess',
      specUri: 'specs/chess/multiplayer.qnt',
      model: binding.model,
      trace: 115,
      seed: '0x67932',
      testId: 'multiplayer.deletion-regression',
      title: 'Third-device deletion with an offline opponent',
    },
    trace: decodeItfTrace(deletionTrace),
    world: quintWorld(),
    binding,
  });
  expect(result).not.toBeNull();
}, 60_000);
