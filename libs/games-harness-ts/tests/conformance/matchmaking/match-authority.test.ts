/**
 * The shared match authority, for every game that offers finding an
 * opponent: one accepted turn at a time, refusals for the wrong person, a
 * refused action, a stale or repeated request and a finished game — none of
 * which changes the game — a rematch that keeps the result, and
 * reconnection to the same match. Moves come from each game's fixtures, so
 * a new game is held to the contract without a copy.
 */

import { expect, test } from 'bun:test';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import { opponentSearchView } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { playedRulesOf } from '@libs/game-session-harness-ts/played-rules';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';
import { agreed, command, matched, rematched } from '../match-authority-world';

forEveryGame(import.meta.path, (game) => {
  // Moves are proposals; the authority plays them with the game's known setups.
  const rules = playedRulesOf(game);
  const victory = game.fixtures.firstSideVictory;
  const opening = victory[0]!;

  test('the authority refuses the wrong, repeated, stale and late moves, and a rematch keeps the result', async () => {
    await using s = await openConformanceHarness(
      `${game.shared.id}-match-authority`
    );
    const roster = await matched(s, game);
    const people = roster.people;
    let match = roster.match;
    const id = match.id;
    expect(
      await command(s, people[1]!, {
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
    expect(await command(s, people[0]!, first)).toBe(true);
    expect(await command(s, people[0]!, first)).toBe(true);
    match = await agreed(s, people);
    expect(match.revision).toBe(1);
    expect(
      await command(s, people[1]!, {
        gameId: id,
        revision: 0,
        uci: victory[1],
        requestId: 'stale',
      })
    ).toBe(false);
    for (const move of victory.slice(1)) {
      match = await agreed(s, people);
      expect(
        await command(s, people[match.revision % people.length]!, {
          gameId: id,
          revision: match.revision,
          uci: move,
          requestId: `move-${match.revision}`,
        })
      ).toBe(true);
    }
    const finished = await agreed(s, people);
    expect(finished.outcome).toBe('white');
    expect(
      await command(s, people[1]!, {
        gameId: id,
        revision: finished.revision,
        uci: opening,
        requestId: 'after-victory',
      })
    ).toBe(false);
    const rematch = await rematched(s, people, game, finished);
    expect(rematch.fen).toBe(rules.initial());
  }, 180_000);

  test("a refused action changes no participant's game", async () => {
    await using s = await openConformanceHarness(
      `${game.shared.id}-match-refused`
    );
    const { match, people } = await matched(s, game);
    for (const [index, refused] of game.fixtures.refusedOpenings.entries())
      expect(
        await command(s, people[0]!, {
          gameId: match.id,
          revision: 0,
          uci: refused,
          requestId: `refused-${String(index)}`,
        })
      ).toBe(false);
    const unchanged = await agreed(s, people);
    expect(unchanged.revision).toBe(0);
    expect(unchanged.fen).toBe(rules.initial());
  }, 180_000);

  test('a reconnecting participant receives every preceding turn and can play their own', async () => {
    await using s = await openConformanceHarness(
      `${game.shared.id}-match-reconnect`
    );
    const { match, people } = await matched(s, game);
    const returning = people[people.length - 1]!;
    await s.apply(setMultiplayerConnection, returning, false);
    const moves = victory.slice(0, people.length - 1);
    for (const [index, move] of moves.entries())
      expect(
        await command(s, people[index]!, {
          gameId: match.id,
          revision: index,
          uci: move,
          requestId: `away-${index}`,
        })
      ).toBe(true);
    const waiting = await agreed(s, people.slice(0, -1));
    expect(waiting.revision).toBe(moves.length);
    await s.apply(setMultiplayerConnection, returning, true);
    await s.until((world) => opponentSearchView(world, returning), {
      pred: (view) => view.game?.revision === moves.length,
    });
    const restored = await agreed(s, people);
    expect(restored.id).toBe(match.id);
    expect(restored.fen).toBe(rules.replay(moves, moves.length));
    expect(
      await command(s, returning, {
        gameId: match.id,
        revision: moves.length,
        uci: victory[moves.length],
        requestId: 'returned-turn',
      })
    ).toBe(true);
    expect((await agreed(s, people)).revision).toBe(people.length);
  }, 180_000);

  test('concurrent requests consume a single turn', async () => {
    await using s = await openConformanceHarness(
      `${game.shared.id}-concurrent-turn`
    );
    const { match, people } = await matched(s, game);
    // Two different moves when the game offers them, else one sent twice.
    const choices = [
      opening,
      rules.legal(rules.initial()).find((uci) => uci !== opening) ?? opening,
    ];
    await Promise.all(
      choices.map((uci, index) =>
        s.apply(sendMultiplayerCommand, people[0]!, {
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
    const accepted = await agreed(s, people);
    expect(accepted.revision).toBe(1);
    expect(choices.map((uci) => rules.replay([uci], 1))).toContain(
      accepted.fen
    );
  }, 180_000);
});
