/**
 * In a matched game of every game with private setups, each person's
 * device holds their own setup alone, read from every row it keeps, through
 * pairing, both setups chosen and play: the opponent's never reaches it.
 */

import { expect, test } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { deviceRowsOf } from '@libs/game-session-harness/private-setup-observation';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
    test("each person's device holds their own setup and never the opponent's", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-matched-private-setup`
      );
      const setups = game.fixtures.setups;
      if (setups === undefined)
        throw new Error(`${game.label} names no setups`);
      await s.apply(seekGameOpponent, 'alice', game.shared.id);
      await s.apply(seekGameOpponent, 'bob', game.shared.id);
      await s.apply(pairGameOpponents, 'alice', true);
      const match = (
        await s.until((world) => opponentSearchView(world, 'alice'), {
          pred: (view) => view.game?.setup_ready === 'white,black',
        })
      ).game!;
      await s.apply(sendMultiplayerCommand, 'alice', {
        name: 'playMultiplayerMove',
        args: {
          gameId: match.id,
          revision: 0,
          uci: game.fixtures.firstSideVictory[0]!,
          requestId: 'first-move',
        },
      });
      expect((await s.read(multiplayerCommandReply, 'alice'))?.result.ok).toBe(
        true
      );
      await s.until((world) => opponentSearchView(world, 'bob'), {
        pred: (view) => view.game?.revision === 1,
      });
      const alice = await s.read(deviceRowsOf, 'alice');
      const bob = await s.read(deviceRowsOf, 'bob');
      expect([
        alice.includes(setups.white),
        alice.includes(setups.black),
      ]).toEqual([true, false]);
      expect([bob.includes(setups.white), bob.includes(setups.black)]).toEqual([
        false,
        true,
      ]);
    }, 240_000);
  },
  ['a private setup']
);
