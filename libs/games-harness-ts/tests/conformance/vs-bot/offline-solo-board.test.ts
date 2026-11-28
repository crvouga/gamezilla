/**
 * A solo game session against a bot, for every game offering game sessions:
 * the host takes their own place with the ordinary choice, and with no
 * connection still plays on the board itself — the game's own gesture, never
 * a command sent around a disabled board — and receives the local bot's
 * reply.
 */

import { expect, test } from 'bun:test';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import { GAME_SESSION_BOARD } from '@libs/game-session-harness-ts/game-session-moves';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { recordedMove } from '@libs/game-session-harness-ts/played-rules';
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
          GAME_SESSION_BOARD,
          action
        ),
    });

    // regression: game-session-offline-host-board-disabled
    // regression: solo-custom-setup-self-invitation
    test("an offline solo host plays the game's opening on the board and receives the local bot reply", async () => {
      await using s = await openConformanceHarness();
      await s.apply(establishGameSession, game.shared.id, {
        first: 'alice',
        second: 'bot',
      });
      await cutConnection({ s }, 'alice');
      const opening = game.fixtures.firstSideVictory[0]!;
      await s.apply(playOnBoard, 'alice', opening);
      const played = await s.until((world) => gameSessionView(world, 'alice'), {
        maxMs: 5000,
        pred: (view) => view.current?.moves.length === 2,
      });
      // Recorded as the room records it: resolved from the known deal the
      // device dealt, for a game with dealt hands.
      expect(played.current?.moves[0]?.uci).toBe(
        recordedMove(game, game.shared.turnGame.rules.initial(), opening)
      );
      expect(played.current?.turn).toBe('white');
    }, 120_000);
  },
  // A game with private setups is never played on the host's device alone;
  // one with dealt hands is, dealing from the device's own draws.
  ['played on one device', 'two seats']
);
