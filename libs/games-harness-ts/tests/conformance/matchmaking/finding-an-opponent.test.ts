/**
 * Finding an opponent, for every game offering it: the Find control
 * commits a search in the game's own clock namespace, an accepted request
 * reaches its owner through ordinary sync, a waiting search gets the shared
 * expanding-range retry, the search and the lineup show every detail apart,
 * and the clocks are announced by the game's own side names. Each test pins
 * the literal input of a bug the shared session once had.
 */

import { expect, test } from 'bun:test';
import {
  awaitGameMatch,
  givenMultiplayerRating,
  givenOpponentSearch,
  pairGameOpponents,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import {
  opponentRetryDelays,
  retryWaitingOpponents,
} from '@libs/game-matchmaking-harness-ts/multiplayer-formation-retry';
import {
  shownMultiplayerLineup,
  shownMultiplayerSearch,
} from '@libs/game-matchmaking-harness-ts/multiplayer-presentation';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  givenGameSpace,
  openFindingAnOpponent,
  opponentSearchView,
  seekGameOpponent,
  stopSeekingOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { gameSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { actorHtml } from '@libs/harness-ts/observations';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryTurnGame } from '../game-suite';

/** The game's clock namespace (`''` or `<id>/`), from its definition. */
function namespace(game: TurnHarnessGame): string {
  const matchmaking = game.shared.registration.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${game.label} offers no finding an opponent`);
  return matchmaking.namespace;
}

/** How the game names a side to a person. */
function sideName(game: TurnHarnessGame, side: 'white' | 'black'): string {
  const presentation = game.client.presentation;
  if (presentation === undefined)
    throw new Error(`${game.label} has no board to name its sides`);
  return presentation.sideLabel(side);
}

forEveryTurnGame(import.meta.path, (game) => {
  const id = game.shared.id;
  const at = (clock: string) => `${namespace(game)}${clock}`;

  // regression: game-session-ui-rules-port-missing
  test('the fresh Find control commits its namespaced search through the injected UI rules port', async () => {
    await using s = await openConformanceHarness(`${id}-find-ui-rules-port`);
    await s.apply(seekGameOpponent, 'alice', id);
    const view = await s.until((world) => opponentSearchView(world, 'alice'), {
      pred: (value) => value.search?.standing === 'waiting',
    });
    expect(view.search?.time_control).toBe(at('5+0'));
    expect(view.waiting).toBe(true);
  }, 120_000);

  // regression: chess-search-keyword-namespace
  test('a literal accepted opponent request reaches its owner through ordinary sync', async () => {
    await using s = await openConformanceHarness(`${id}-accepted-request`);
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(givenGameSpace, 'alice');
    await s.apply(givenOpponentSearch, 'alice', at('5+0'), 'request-1');
    await s.until(
      async (world) =>
        (await multiplayerView(world, 'alice')).search?.standing === 'waiting'
    );
    expect((await s.read(multiplayerView, 'alice')).search).toEqual(
      expect.objectContaining({ standing: 'waiting', time_control: at('5+0') })
    );
  }, 120_000);

  // regression: shared-formation-retry-chess-pool-only
  // regression: formation-retry-observation-consumes-time
  test('a waiting opponent receives the shared expanding-range retry', async () => {
    await using s = await openConformanceHarness(`${id}-formation-retry`);
    await s.apply(seekGameOpponent, 'alice', id);
    await s.apply(retryWaitingOpponents);
    const deadline = await s.read(async (state) => {
      const joined = (await multiplayerView(state, 'alice')).search
        ?.joined_at_ms;
      if (joined === null || joined === undefined)
        throw new Error('No waiting search');
      const delays = await opponentRetryDelays(state);
      return { joined, at: state.harness.clock.now(), delays };
    });
    expect(deadline.delays.map((delay) => deadline.at + delay)).toEqual([
      deadline.joined + 5000,
    ]);
  }, 120_000);

  // regression: game-ui-matchmaking-fields
  test('a 40-second search and a 3+2 lineup expose all their visible details', async () => {
    await using s = await openConformanceHarness(`${id}-match-details`);
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(givenGameSpace, 'alice');
    await s.apply(givenOpponentSearch, 'alice', at('5+0'));
    await s.apply(openFindingAnOpponent, 'alice', id);
    await s.advanceTime(40_000);
    const search = await s.read(shownMultiplayerSearch, 'alice');
    expect(search.message).toContain('5+0');
    expect(search.elapsedSeconds).toBe(40);
    await s.apply(stopSeekingOpponent, 'alice');
    await s.apply(givenOpponentSearch, 'alice', at('3+2'));
    await s.apply(signInWithGoogle, 'bob');
    await s.apply(givenGameSpace, 'bob');
    await s.apply(
      givenMultiplayerRating,
      'bob',
      gameSpeed(namespace(game), 'blitz'),
      { rating: 1620, games: 20 }
    );
    await s.apply(givenOpponentSearch, 'bob', at('3+2'));
    await s.apply(awaitGameMatch, 'alice', 'bob', true);
    await s.apply(openFindingAnOpponent, 'alice', id);
    const lineup = await s.until(
      (world) => shownMultiplayerLineup(world, 'alice'),
      { pred: (shown) => shown.opponent !== null }
    );
    expect(lineup).toEqual({
      opponent: 'bob (1620)',
      timeControl: '3+2',
      colour: `You play ${sideName(game, 'white')}`,
    });
  }, 120_000);

  // regression: shared-clock-spoken-chess-colours
  test("the clocks are announced by the game's own side names", async () => {
    await using s = await openConformanceHarness(`${id}-spoken-clocks`);
    await s.apply(seekGameOpponent, 'alice', id);
    await s.apply(seekGameOpponent, 'bob', id);
    await s.apply(pairGameOpponents, 'alice', true);
    const html = (await s.read(actorHtml, 'alice')) ?? '';
    expect(html).toContain(`${sideName(game, 'white')} has 5:00 left`);
    expect(html).toContain(`${sideName(game, 'black')} has 5:00 left`);
  }, 120_000);
});
