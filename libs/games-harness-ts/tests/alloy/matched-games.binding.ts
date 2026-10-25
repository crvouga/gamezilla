import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import {
  givenOpponentSearch,
  pairGameOpponents,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { storedMultiplayerSnapshot } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import {
  matchRoomGame,
  matchRoomTopic,
} from '@libs/game-matchmaking-shared-ts/match-room';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { bindStructure } from '@pkgs/alloy-shared-ts/registry';
import type { Snapshot } from '@pkgs/alloy-shared-ts/world';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';
import { projectMatchedGames } from './matched-games-projection';

async function gameCommand(
  s: OpenHarness,
  actor: string,
  name: string,
  args: Record<string, unknown>
) {
  await s.apply(sendMultiplayerCommand, actor, {
    name,
    args: {
      requestId: `${name}-${actor}-${String(args['uci'] ?? '')}`,
      ...args,
    },
  });
}

async function latest(s: OpenHarness) {
  const games = (await s.read(storedMultiplayerSnapshot)).games;
  return games.find((g) => g.outcome === 'ongoing') ?? games.at(-1)!;
}

/** The stored worlds one game's matched games pass through, each labelled for it. */
async function beginGame(
  s: OpenHarness,
  game: HarnessGame,
  gameId: string
): Promise<void> {
  if (!isTurnHarnessGame(game)) {
    for (const actor of ['alice', 'bob'])
      await s.apply(openFindingAnOpponent, actor, game.shared.id);
    // Wait for the game's own lifecycle, without assuming any countdown length.
    await s.until(
      async (world) => {
        const state = await world.harness.roomNode.services.read(
          matchRoomTopic(gameId)
        );
        return (
          state !== null && matchRoomGame(state)?.execution?.started === true
        );
      },
      { pred: (begun) => begun, maxMs: 10_000 }
    );
    return;
  }
  const [firstMove, secondMove] = game.fixtures.firstSideVictory;
  for (const [actor, uci, revision] of [
    ['alice', firstMove, 0],
    ['bob', secondMove, 1],
  ] as const)
    await gameCommand(s, actor, 'playMultiplayerMove', {
      gameId,
      revision,
      uci,
    });
  if ((await latest(s)).revision !== 2)
    throw new Error(`${game.label}: the first moves were not accepted`);
}

async function matchedGameWorlds(game: HarnessGame): Promise<Snapshot[]> {
  const matchmaking = game.shared.registration.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${game.label} offers no finding an opponent`);
  // regression: games-bindings-assume-clocked-turn-games
  const clock = (choice: string) =>
    matchmaking.clockChoices === true
      ? `${matchmaking.namespace}${choice}`
      : defaultMatchChoice(matchmaking);
  await using s = await openConformanceHarness(
    `legal-matched-worlds-${game.shared.id}`
  );
  const worlds: Snapshot[] = [];
  const keep = async (label: string) =>
    worlds.push(
      projectMatchedGames(
        await s.read(storedMultiplayerSnapshot),
        `${label} [${game.label}]`
      )
    );
  for (const actor of ['alice', 'bob', 'carol', 'dave']) {
    await s.apply(signInWithGoogle, actor);
    await s.apply(givenGameSpace, actor);
  }
  await s.apply(givenOpponentSearch, 'alice', clock('5+0'), 'first');
  await s.advanceTime(1);
  await s.apply(givenOpponentSearch, 'bob', clock('5+0'), 'first');
  await s.apply(pairGameOpponents, 'alice', true);
  await keep('one complete matched game');
  const first = await latest(s);
  await beginGame(s, game, first.id);
  await keep('the matched game is under way');
  await gameCommand(s, 'bob', 'resignMultiplayer', { gameId: first.id });
  if ((await latest(s)).outcome !== 'white')
    throw new Error(`${game.label}: the resignation was not accepted`);
  await keep('one honest result');
  await gameCommand(s, 'bob', 'offerMultiplayerRematch', { gameId: first.id });
  await gameCommand(s, 'alice', 'acceptMultiplayerRematch', {
    gameId: first.id,
  });
  if ((await latest(s)).rematch_of !== first.id)
    throw new Error(`${game.label}: the rematch was not accepted`);
  await keep('a rematch with the sides swapped at the same clock choice');
  await s.apply(givenOpponentSearch, 'carol', clock('3+2'), 'first');
  await s.advanceTime(1);
  await s.apply(givenOpponentSearch, 'dave', clock('3+2'), 'first');
  await s.apply(pairGameOpponents, 'carol', true);
  const third = await s.read(storedMultiplayerSnapshot);
  const aborted = third.games.find(
    (g) => g.id !== first.id && g.rematch_of !== first.id
  )!;
  await gameCommand(s, 'carol', 'abortMultiplayer', { gameId: aborted.id });
  await keep('an aborted matched game beside a rematch');
  return worlds;
}

bindStructure({
  spec: 'matched-games',
  snapshots: {
    'server database, for every game': async () => {
      const worlds: Snapshot[] = [];
      for (const game of gamesHeldTo('specs/games/matched-games.als'))
        worlds.push(...(await matchedGameWorlds(game)));
      return worlds;
    },
  },
});
