/**
 * In a matched game of every game with private setups, each person's
 * device holds their own setup alone, read from every row it keeps, through
 * pairing, both setups chosen and play: the opponent's never reaches it.
 */

import { expect, test } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { opponentSearchView } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { deviceRowsOf } from '@libs/game-session-harness-ts/private-setup-observation';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryTurnGame } from '../game-suite';
import { matched } from '../match-authority-world';

forEveryTurnGame(
  import.meta.path,
  (game) => {
    test("each person's device holds their own setup and never the opponent's", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-matched-private-setup`
      );
      const setups = game.fixtures.setups;
      if (setups === undefined)
        throw new Error(`${game.label} names no setups`);
      // regression: matchmaking-privacy-assumes-seat-order
      const { match, people } = await matched(s, game);
      const white = people[0]!;
      const black = people[1]!;
      await s.apply(sendMultiplayerCommand, white, {
        name: 'playMultiplayerMove',
        args: {
          gameId: match.id,
          revision: 0,
          uci: game.fixtures.firstSideVictory[0]!,
          requestId: 'first-move',
        },
      });
      expect((await s.read(multiplayerCommandReply, white))?.result.ok).toBe(
        true
      );
      await s.until((world) => opponentSearchView(world, black), {
        pred: (view) => view.game?.revision === 1,
      });
      const whiteRows = await s.read(deviceRowsOf, white);
      const blackRows = await s.read(deviceRowsOf, black);
      expect([
        whiteRows.includes(setups.white),
        whiteRows.includes(setups.black),
      ]).toEqual([true, false]);
      expect([
        blackRows.includes(setups.white),
        blackRows.includes(setups.black),
      ]).toEqual([false, true]);
    }, 240_000);
  },
  ['a private setup', 'two seats']
);
