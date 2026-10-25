import { expect } from 'bun:test';
import {
  boardBeforeMove,
  bothBoards,
  inMatchedGame,
  matchedGameOf,
  move,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { partition } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { before, gameOf, setupCustomGame, sideOf, view } from './game-world';
import { knownNextMove } from './known-line';
import { nextVictoryMove, told } from './matched-game';
import {
  boardTakesNoMove,
  reviewsEarlierPosition,
} from './matched-game-review-world';

const SECOND_MS = 1000;

Given(
  "{actor} and {actor} have a custom game after {actor}'s first move",
  async (w) => {
    await setupCustomGame(w, {
      moves: gameOf(w).fixtures.firstSideVictory.slice(0, 1),
    });
  }
);
Given('{actor} and {actor} have a new custom game', async (w) =>
  setupCustomGame(w)
);
Given(
  '{actor} and {actor} have a new custom game without a connection',
  async (w, a: string, b: string) => {
    await setupCustomGame(w);
    await w.s.apply(partition, a);
    await w.s.apply(partition, b);
  }
);
Given('{actor} has a custom game one move from her victory', async (w) => {
  const victory = gameOf(w).fixtures.firstSideVictory;
  await setupCustomGame(w, { moves: victory.slice(0, -1) });
  w.memo.set('winning-move', victory.at(-1));
});

// A custom game's next move, or the matched game's next move of the game's victory.
When('{actor} makes his/her/a move', async (w, actor: string) => {
  if (reviewsEarlierPosition(w, actor)) await boardTakesNoMove(w, actor);
  else if (inMatchedGame(w)) {
    const { revision } = await matchedGameOf(w, actor);
    await move(w, actor, nextVictoryMove(w, revision));
  } else {
    // A custom game following a known line makes the line's next move.
    const ply = (await view(w, actor)).current?.moves.length ?? 0;
    const next = knownNextMove(w, ply);
    if (next === undefined)
      await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id);
    else await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id, next);
  }
});
When('{actor} makes the winning move', async (w, actor: string) => {
  const winning = String(w.memo.get('winning-move'));
  if (inMatchedGame(w)) await move(w, actor, winning);
  else await w.s.apply(makeCustomGameMove, actor, gameOf(w).shared.id, winning);
});

Then(
  "{actor} is told it is the other player's turn",
  async (w, actor: string) => {
    if (inMatchedGame(w)) await told(w, actor, 'CHESS_NOT_YOUR_TURN');
    else
      expect((await view(w, actor)).error).toContain(
        'only the participant to move'
      );
  }
);
Then('the board and turn are unchanged', async (w) => {
  if (inMatchedGame(w)) {
    const earlier = boardBeforeMove(w);
    if (earlier === null) throw new Error('No move was made');
    const now = await bothBoards(w);
    expect({ fen: now.fen, turn: now.turn, revision: now.revision }).toEqual({
      fen: earlier.fen,
      turn: earlier.turn,
      revision: earlier.revision,
    });
    return;
  }
  const now = await view(w);
  expect(now.current).toEqual(before(w).current);
  expect(now.displayFen).toBe(before(w).displayFen);
});
Then(
  "{actor} sees {actor}'s move within {int} seconds",
  async (w, watcher: string, _mover: string, seconds: number) => {
    await w.s.until((s) => customGameView(s, watcher), {
      maxMs: seconds * SECOND_MS,
      pred: (seen) => seen.current?.moves.length === 1,
    });
  }
);
Then(
  '{actor} is told the game needs a connection',
  async (w, actor: string) => {
    if (inMatchedGame(w)) await told(w, actor, 'OFFLINE');
    else expect((await view(w, actor)).error).toBe('connection needed');
  }
);
Then('{actor} wins the custom game', async (w, actor: string) => {
  expect((await view(w)).current?.outcome).toStartWith(
    `${(await view(w, actor)).mySide} wins`
  );
});
Then('{actor} is told the game is finished', async (w, actor: string) => {
  expect((await view(w, actor)).error).toBe('finished');
});
