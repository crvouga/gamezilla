import './index';
import { describe, expect, test } from 'bun:test';
import { decodeItfTrace } from '@pkgs/quint-shared-ts/itf';
import { quintBinding, quintWorld } from '@pkgs/quint-shared-ts/registry';
import { replayTrace } from '@pkgs/quint-shared-ts/replay';
import { gamesHeldTo } from '../conformance-world';
import deletionTrace from './fixtures/multiplayer-third-device-deletion.itf.json';

const SPEC_URI = 'specs/games/matched-game.qnt';

describe.each(gamesHeldTo(SPEC_URI).map((game) => [game.label, game] as const))(
  '%s',
  (_label, game) => {
    // regression: chess-deletion-refreshes-connected-devices
    test('Carol’s third-device deletion clears her devices while Alice’s offline computer keeps its board', async () => {
      const binding = quintBinding('matched-game');
      const result = await replayTrace({
        ctx: {
          packageName: '@libs/games-harness-ts',
          specUri: SPEC_URI,
          model: binding.model,
          trace: 1,
          seed: '0x67932',
          testId: `matched-game.deletion-regression.${game.shared.id}`,
          title: `Third-device deletion with an offline opponent [${game.label}]`,
          variant: { id: game.shared.id, label: game.label },
        },
        trace: decodeItfTrace(deletionTrace),
        world: quintWorld(),
        binding,
      });
      expect(result).not.toBeNull();
    }, 120_000);
  }
);
