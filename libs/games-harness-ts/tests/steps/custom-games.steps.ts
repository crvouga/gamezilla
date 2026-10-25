import { expect } from 'bun:test';
import {
  bothBoards,
  inMatchedGame,
  ownerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { playCustomGameBots } from '@libs/game-session-harness-ts/custom-game-bots';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { attemptCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { choose } from './custom-game-set-up-world';
import {
  before,
  gameOf,
  setupCustomGame,
  sideOf,
  turnGameOf,
  view,
} from './game-world';
import { playsPuzzles, solverToMove } from './puzzle-world';

const SECOND_MS = 1000;

const LINEUPS: Readonly<
  Record<string, { readonly first: string; readonly second: string }>
> = {
  'two ready people': { first: 'alice', second: 'bob' },
  'a ready person on the first side and a bot on the second side': {
    first: 'alice',
    second: 'bot',
  },
  'a bot on the first side and a ready person on the second side': {
    first: 'bot',
    second: 'alice',
  },
  'two bots': { first: 'bot', second: 'bot' },
};

Given(
  '{actor} has a custom game with {gameParticipants}',
  async (w, _actor: string, participants: string) => {
    const lineup = LINEUPS[participants];
    if (lineup === undefined) throw new Error(`Unknown lineup ${participants}`);
    await setupCustomGame(w, { ...lineup, active: false });
  }
);
Given('{actor} has a custom game with an open second side', async (w) =>
  setupCustomGame(w, { second: 'open', active: false })
);
When('{actor} starts the custom game', async (w, actor: string) =>
  choose(w, actor, { operation: 'start' })
);
Then('the custom game is under way', async (w) => {
  expect((await view(w)).current?.status).toBe('active');
});
Then(
  '{actor} is told both sides need participants',
  async (w, actor: string) => {
    expect((await view(w, actor)).error).toBe('both sides need participants');
  }
);

Given('{actor} and {actor} have a custom game under way', async (w) =>
  setupCustomGame(w)
);
Given(
  '{actor} and {actor} have a custom game under way watched by {actor}',
  async (w, _a: string, _b: string, watcher: string) =>
    setupCustomGame(w, { watchers: [watcher] })
);
When('{actor} resigns the custom game', async (w, actor: string) => {
  await w.s.apply(attemptCustomGame, actor, { operation: 'resign' });
});
Then(
  '{actor} wins the custom game by resignation',
  async (w, actor: string) => {
    expect((await view(w)).current?.outcome).toBe(
      `${await sideOf(w, actor)} wins by resignation`
    );
  }
);
Then('{actor} is told she is not a participant', async (w, actor: string) => {
  expect((await view(w, actor)).error).toBe('not a participant');
});

Given('{actor} has a finished custom game', async (w) =>
  setupCustomGame(w, { moves: turnGameOf(w).fixtures.firstSideVictory })
);
When('{actor} asks for a rematch', async (w, actor: string) => {
  await w.s.apply(attemptCustomGame, actor, { operation: 'rematch' });
});
Then('the new custom game has the sides swapped and no moves', async (w) => {
  const earlier = before(w).current;
  const next = (await view(w)).current;
  expect(next?.id).not.toBe(earlier?.id);
  expect(next?.white).toEqual(earlier?.black);
  expect(next?.black).toEqual(earlier?.white);
  expect(next?.moves).toEqual([]);
  expect(next?.fen).toBe(gameOf(w).shared.registration.rules.initial());
});
Then('the earlier custom game is unchanged in the history', async (w) => {
  const earlier = before(w).current;
  expect(
    (await view(w)).history.find((game) => game.id === earlier?.id)
  ).toEqual(earlier!);
});

Given(
  '{actor} and {actor} have a custom game under way and {actor} is away',
  async (w, a: string, b: string, away: string) => {
    const other = away === a ? b : a;
    await setupCustomGame(w, { host: other, first: other, second: away });
    await w.s.apply(partition, away);
  }
);
Given('{actor} has made the next move', async (w, actor: string) => {
  await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id);
});
When('{actor} returns to the custom game', async (w, actor: string) => {
  await w.s.apply(restoreActorConnection, actor);
});
Then(
  '{actor} and {actor} see the same board and turn',
  async (w, a: string, b: string) => {
    const second = await view(w, b);
    const first = await w.s.until((s) => customGameView(s, a), {
      maxMs: 15 * SECOND_MS,
      pred: (seen) =>
        seen.displayFen === second.displayFen &&
        seen.current?.turn === second.current?.turn,
    });
    expect(first.current?.moves).toEqual(second.current?.moves);
  }
);

Given(
  '{actor} has a custom game under way against a bot while offline',
  async (w, actor: string) => {
    await setupCustomGame(w, { first: actor, second: 'bot' });
    await w.s.apply(partition, actor);
  }
);
When('{actor} makes her move on the board', async (w, actor: string) => {
  await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id);
});
Then("it is {actor}'s turn", async (w, actor: string) => {
  // On a puzzle's board, the solver is to move.
  if (playsPuzzles(w, actor)) return solverToMove(w, actor);
  if (inMatchedGame(w)) {
    const owner = await ownerOf(w, actor);
    expect((await bothBoards(w, (g) => g.turn === owner)).turn).toBe(owner);
  } else expect((await view(w)).current?.turn).toBe(await sideOf(w, actor));
});

Given('{actor} has a custom game under way between two bots', async (w) =>
  setupCustomGame(w, { first: 'bot', second: 'bot' })
);
When('the bots play their turns', async (w) => {
  await w.s.apply(playCustomGameBots);
});
Then('the custom game is finished with a victory or a draw', async (w) => {
  const game = (await view(w)).current;
  expect(game?.status).toBe('completed');
  expect(game?.outcome).toMatch(/wins|draw/);
});
