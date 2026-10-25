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
import { pairGameOpponents } from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { deviceRowsOf } from '@libs/game-session-harness-ts/private-setup-observation';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

forEveryGame(
  import.meta.path,
  (game) => {
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
      await s.apply(seekGameOpponent, 'alice', game.shared.id);
      await s.apply(seekGameOpponent, 'bob', game.shared.id);
      await s.apply(pairGameOpponents, 'alice', true);
      const match = (
        await s.until((world) => opponentSearchView(world, 'alice'), {
          pred: (view) => view.game !== null,
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
      // After the first move: Alice holds her refilled hand, Bob his first.
      expect([
        alice.includes(second.white),
        alice.includes(first.black),
      ]).toEqual([true, false]);
      expect([bob.includes(second.white), bob.includes(first.black)]).toEqual([
        false,
        true,
      ]);
      for (const rows of [alice, bob])
        expect(rows.includes('"bag"')).toBe(false);
    }, 240_000);
  },
  ['dealt hands', 'two seats']
);
