import { expect } from 'bun:test';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import { givenMultiplayerRating } from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { opponentSearchPresentation } from '@libs/game-matchmaking-harness-ts/multiplayer-presentation';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { gameSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import { Given, Then, When } from '@libs/harness-ts/define';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { seeking } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { readyPeople } from './matched-game';
import { pairUp } from './matched-game-pairing';

Given('the game offers no clock choice', (w) => {
  expect(
    gameOf(w).shared.registration.capabilities.matchmaking?.clockChoices
  ).toBeUndefined();
});

Given(
  '{actor} has a rating of {int} for the game',
  async (w, actor: string, rating: number) => {
    await readyPeople(w, [actor]);
    const matched = gameOf(w).shared.registration.capabilities.matchmaking!;
    await w.s.apply(
      givenMultiplayerRating,
      actor,
      gameSpeed(matched.namespace, 'game'),
      { rating, games: 20 }
    );
  }
);

Given(
  '{actor} is seeking an opponent for the game without a connection',
  async (w, actor: string) => {
    await seeking(w, actor);
    await w.s.apply(setMultiplayerConnection, actor, false);
  }
);

Given(
  '{actor} was paired with {actor} while her device was offline',
  async (w, actor: string, opponent: string) => {
    await seeking(w, actor);
    await w.s.apply(setMultiplayerConnection, actor, false);
    await seeking(w, opponent);
    await pairUp(w);
    const game = await w.s.until(
      async (s) => (await multiplayerView(s, opponent)).game,
      { pred: (game) => game !== null }
    );
    w.memo.set('multiplayer:game', game);
    w.memo.set('multiplayer:pair', [actor, opponent]);
  }
);

When('{actor} comes back online', (w, actor: string) =>
  w.s.apply(setMultiplayerConnection, actor, true)
);

async function withoutClock(w: HarnessWorld, actor: string) {
  return w.s.read(opponentSearchPresentation, actor);
}

Then('{actor} is not asked to choose a clock', async (w, actor: string) => {
  expect(await withoutClock(w, actor)).toMatchObject({
    clockChoices: [],
    whiteClock: null,
    blackClock: null,
    clockDetail: null,
    firstMoveCountdown: null,
  });
});

Then(
  '{actor} sees she has been waiting for an opponent for {int} seconds without a clock choice',
  async (w, actor: string, seconds: number) => {
    expect(await withoutClock(w, actor)).toMatchObject({
      waitingSeconds: String(seconds),
      clockChoices: [],
      clockDetail: null,
    });
  }
);

Then(
  '{actor} sees {actor} as her/his opponent, with a rating of {string} and her/his side, without a clock choice',
  async (w, actor: string, opponent: string, rating: string) => {
    await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
    const view = await w.s.until((s) => opponentSearchPresentation(s, actor), {
      pred: (view) => view.opponent?.includes(rating) === true,
    });
    expect(view.opponent).toContain(opponent);
    expect(view.opponent).toContain(`(${rating})`);
    const game = (await w.s.read(multiplayerView, actor)).game!;
    expect([game.white_id, game.black_id]).toContain(
      (await w.s.read(accountIdOf, opponent))!
    );
    expect(view.side).toContain(
      gameOf(w).client.presentation.sideLabel(
        game.white_id === (await w.s.read(accountIdOf, actor))
          ? 'white'
          : 'black'
      )
    );
    expect(view).toMatchObject({
      clockChoices: [],
      whiteClock: null,
      blackClock: null,
      clockDetail: null,
    });
  }
);
