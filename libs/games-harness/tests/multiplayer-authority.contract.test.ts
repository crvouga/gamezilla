/**
 * The shared match authority, for every game that offers finding an
 * opponent: one accepted turn at a time, refusals for the wrong person, a
 * stale or repeated request and a finished game, a rematch that keeps the
 * result, and reconnection to the same match. Moves come from each game's
 * own rules, so a new game is held to the contract without a copy.
 */

import { expect, test } from 'bun:test';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import { pairGameOpponents } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  opponentSearchView,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { firstLegalMove } from '@libs/game-session-harness/custom-game-moves';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { openGamesHarness } from '@libs/games-harness/games-system';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { OpenHarness } from '@libs/harness/open-harness';

const MATCHED = HARNESS_GAMES.filter((game) =>
  game.shared.turnGame.capabilities.includes('matchmaking')
);

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

for (const game of MATCHED) {
  const rules = game.shared.turnGame.rules;
  const opening = firstLegalMove(game, rules.initial());

  test(`${game.label}: the authority refuses the wrong, repeated, stale and late moves, and a rematch keeps the result`, async () => {
    await using s = await openGamesHarness(`${game.shared.id}-match-authority`);
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
      uci: game.firstSideVictory[0],
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
        uci: game.firstSideVictory[1],
        requestId: 'stale',
      })
    ).toBe(false);
    for (const move of game.firstSideVictory.slice(1)) {
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

  test(`${game.label}: a reconnecting player receives the opponent's accepted move in the same match`, async () => {
    await using s = await openGamesHarness(`${game.shared.id}-match-reconnect`);
    const match = await paired(s, game);
    const [mine, theirs] = game.firstSideVictory;
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

  test(`${game.label}: concurrent requests consume a single turn`, async () => {
    await using s = await openGamesHarness(`${game.shared.id}-concurrent-turn`);
    const match = await paired(s, game);
    const choices = rules.legal(rules.initial()).slice(0, 2);
    expect(choices).toHaveLength(2);
    await Promise.all(
      choices.map((uci) =>
        s.apply(sendMultiplayerCommand, 'alice', {
          name: 'playMultiplayerMove',
          args: {
            gameId: match.id,
            revision: 0,
            uci,
            requestId: `concurrent-${uci}`,
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
}
