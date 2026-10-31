/**
 * In a matched game of every game whose authority deals hands, each
 * person's device holds their own hand alone, read from every row it keeps,
 * through pairing and play: the opponent's hand and the hidden state never
 * reach it.
 */

import { expect, test } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { opponentSearchView } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { deviceRowsOf } from '@libs/game-session-harness-ts/private-setup-observation';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';
import { matched } from '../match-authority-world';

forEveryGame(
  import.meta.path,
  (game) => {
    if (!isTurnHarnessGame(game))
      throw new Error(`${game.label} has no turn fixtures`);
    test("each person's device holds their own hand and never the opponent's or the hidden state", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-matched-dealt-hands`
      );
      const deal = game.fixtures.knownDeal;
      const [first, second] = deal?.hands ?? [];
      if (
        deal === undefined ||
        first?.black === undefined ||
        second?.white === undefined
      )
        throw new Error(`${game.label} writes no hands of its known deal`);
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
      // After the first move: White holds the refilled hand, Black the first.
      expect([
        whiteRows.includes(second.white),
        whiteRows.includes(first.black),
      ]).toEqual([true, false]);
      expect([
        blackRows.includes(second.white),
        blackRows.includes(first.black),
      ]).toEqual([false, true]);
      for (const rows of [whiteRows, blackRows])
        expect(rows.includes('"bag"')).toBe(false);
    }, 240_000);
  },
  ['dealt hands', 'two seats']
);
