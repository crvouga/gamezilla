/**
 * The shared match authority, for every game that offers finding an
 * opponent: one accepted turn at a time, refusals for the wrong person, a
 * refused action, a stale or repeated request and a finished game — none of
 * which changes the game — a rematch that keeps the result, and
 * reconnection to the same match. Moves come from each game's fixtures, so
 * a new game is held to the contract without a copy.
 */

import { expect, test } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import { pairGameOpponents } from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { playedRulesOf } from '@libs/game-session-harness-ts/played-rules';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

async function paired(s: OpenHarness, game: HarnessGame) {
  await s.apply(seekGameOpponent, 'alice', game.shared.id);
  await s.apply(seekGameOpponent, 'bob', game.shared.id);
  await s.apply(pairGameOpponents, 'alice', true);
  return (
    await s.until((world) => opponentSearchView(world, 'alice'), {
      pred: (view) => view.game !== null,
    })
  ).game!;
}

async function command(
  s: OpenHarness,
  actor: string,
  args: Record<string, unknown>,
  name = 'playMultiplayerMove'
) {
  await s.apply(sendMultiplayerCommand, actor, { name, args });
  return (await s.read(multiplayerCommandReply, actor))!.result.ok;
}

/** Both players see the same accepted game. */
async function agreed(s: OpenHarness) {
  const first = (await s.read(opponentSearchView, 'alice')).game!;
  const second = await s.until((world) => opponentSearchView(world, 'bob'), {
    pred: (view) => view.game?.revision === first.revision,
  });
  expect(second.game).toEqual(first);
  return first;
}

forEveryGame(
  import.meta.path,
  (game) => {
    // Moves are proposals; the authority plays them with the game's known setups.
    const rules = playedRulesOf(game);
    const victory = game.fixtures.firstSideVictory;
    const opening = victory[0]!;

    test('the authority refuses the wrong, repeated, stale and late moves, and a rematch keeps the result', async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-match-authority`
      );
      let match = await paired(s, game);
      const id = match.id;
      expect(
        await command(s, 'bob', {
          gameId: id,
          revision: 0,
          uci: opening,
          requestId: 'wrong-turn',
        })
      ).toBe(false);
      const first = {
        gameId: id,
        revision: 0,
        uci: opening,
        requestId: 'first',
      };
      expect(await command(s, 'alice', first)).toBe(true);
      expect(await command(s, 'alice', first)).toBe(true);
      match = await agreed(s);
      expect(match.revision).toBe(1);
      expect(
        await command(s, 'bob', {
          gameId: id,
          revision: 0,
          uci: victory[1],
          requestId: 'stale',
        })
      ).toBe(false);
      for (const move of victory.slice(1)) {
        match = await agreed(s);
        expect(
          await command(s, match.revision % 2 === 0 ? 'alice' : 'bob', {
            gameId: id,
            revision: match.revision,
            uci: move,
            requestId: `move-${match.revision}`,
          })
        ).toBe(true);
      }
      const finished = await agreed(s);
      expect(finished.outcome).toBe('white');
      expect(
        await command(s, 'bob', {
          gameId: id,
          revision: finished.revision,
          uci: opening,
          requestId: 'after-victory',
        })
      ).toBe(false);
      await command(
        s,
        'alice',
        { gameId: id, requestId: 'offer' },
        'offerMultiplayerRematch'
      );
      await command(
        s,
        'bob',
        { gameId: id, requestId: 'accept' },
        'acceptMultiplayerRematch'
      );
      const rematch = await agreed(s);
      expect(rematch.id).not.toBe(id);
      expect(rematch.fen).toBe(rules.initial());
      expect(rematch.white_id).toBe(finished.black_id);
    }, 180_000);

    test("a refused action changes neither player's game", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-match-refused`
      );
      const match = await paired(s, game);
      for (const [index, refused] of game.fixtures.refusedOpenings.entries())
        expect(
          await command(s, 'alice', {
            gameId: match.id,
            revision: 0,
            uci: refused,
            requestId: `refused-${String(index)}`,
          })
        ).toBe(false);
      const unchanged = await agreed(s);
      expect(unchanged.revision).toBe(0);
      expect(unchanged.fen).toBe(rules.initial());
    }, 180_000);

    test("a reconnecting player receives the opponent's accepted move in the same match", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-match-reconnect`
      );
      const match = await paired(s, game);
      const [mine, theirs] = victory;
      await command(s, 'alice', {
        gameId: match.id,
        revision: 0,
        uci: mine,
        requestId: 'first',
      });
      await agreed(s);
      await s.apply(setMultiplayerConnection, 'alice', false);
      await command(s, 'bob', {
        gameId: match.id,
        revision: 1,
        uci: theirs,
        requestId: 'away',
      });
      await s.apply(setMultiplayerConnection, 'alice', true);
      await s.until((world) => opponentSearchView(world, 'alice'), {
        pred: (view) => view.game?.revision === 2,
      });
      const restored = await agreed(s);
      expect(restored.id).toBe(match.id);
      expect(restored.fen).toBe(rules.replay([mine!, theirs!], 2));
    }, 180_000);

    test('concurrent requests consume a single turn', async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-concurrent-turn`
      );
      const match = await paired(s, game);
      // Two different moves when the game offers them, else one sent twice.
      const choices = [
        opening,
        rules.legal(rules.initial()).find((uci) => uci !== opening) ?? opening,
      ];
      await Promise.all(
        choices.map((uci, index) =>
          s.apply(sendMultiplayerCommand, 'alice', {
            name: 'playMultiplayerMove',
            args: {
              gameId: match.id,
              revision: 0,
              uci,
              requestId: `concurrent-${String(index)}`,
            },
          })
        )
      );
      const accepted = await agreed(s);
      expect(accepted.revision).toBe(1);
      expect(choices.map((uci) => rules.replay([uci], 1))).toContain(
        accepted.fen
      );
    }, 180_000);
  },
  ['two seats']
);
