/**
 * A solo custom game against a bot, for every game offering custom games:
 * the host takes their own place with the ordinary choice, and with no
 * connection still plays on the board itself — the game's own gesture, never
 * a command sent around a disabled board — and receives the local bot's
 * reply.
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { CUSTOM_GAME_BOARD } from '@libs/game-session-harness-ts/custom-game-moves';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { cutConnection } from '@libs/harness-ts/platform';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryTurnGame } from '../game-suite';

forEveryTurnGame(
  import.meta.path,
  (game) => {
    /** `actor` plays `action` with the board's own gesture, and nothing else. */
    const playOnBoard = scenarioAction({
      name: 'playOnBoard',
      act: async (s, actor: string, action: string) =>
        game.shared.automation.turns.perform(
          await actorUi(s, actor),
          CUSTOM_GAME_BOARD,
          action
        ),
    });

    // regression: game-session-offline-host-board-disabled
    // regression: solo-custom-setup-self-invitation
    test("an offline solo host plays the game's opening on the board and receives the local bot reply", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-offline-solo-board`
      );
      await s.apply(establishCustomGame, game.shared.id, {
        first: 'alice',
        second: 'bot',
      });
      await cutConnection({ s }, 'alice');
      const opening = game.fixtures.firstSideVictory[0]!;
      await s.apply(playOnBoard, 'alice', opening);
      const played = await s.until((world) => customGameView(world, 'alice'), {
        maxMs: 5000,
        pred: (view) => view.current?.moves.length === 2,
      });
      expect(played.current?.moves[0]?.uci).toBe(opening);
      expect(played.current?.turn).toBe('white');
    }, 120_000);
  },
  // A game with private setups is never played on the host's device alone.
  ['every position public', 'two seats']
);
