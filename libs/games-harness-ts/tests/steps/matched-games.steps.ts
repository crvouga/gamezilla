import { expect } from 'bun:test';
import {
  acceptedMoves,
  bothBoards,
  gameCommand,
  resignation,
  winner,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  abortedAt,
  firstMoveOf,
  firstMoves,
  pairedAt,
  told,
} from './matched-game';

const SECOND_MS = 1000;

Given(
  '{actor} has the first side against {actor} in a new matched game',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
  }
);
Given(
  '{actor} has an unfinished matched game with {actor}',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
  }
);
Given(
  '{actor} has the first side against {actor} in a {word} matched game after their first moves',
  async (w, first: string, second: string, clock: string) => {
    await pairedAt(w, first, second, clock);
    await firstMoves(w);
  }
);
Given(
  '{actor} has made her first move in a new matched game against {actor}',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    await acceptedMoves(w, [firstMoveOf(w, first)]);
  }
);
Given(
  '{actor} made her first move {int} seconds into her new matched game with {actor}',
  async (w, first: string, seconds: number, second: string) => {
    await pairedAt(w, first, second);
    await w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
    await acceptedMoves(w, [firstMoveOf(w, first)]);
  }
);
Given('{actor} has made his/her first move', async (w, actor: string) => {
  await acceptedMoves(w, [firstMoveOf(w, actor)]);
});
Given(
  '{actor} has resigned the matched game after their first moves',
  async (w, actor: string) => {
    await pairedAt(w, 'alice', 'bob');
    await firstMoves(w);
    expect((await resignation(w, actor)).result.ok).toBe(true);
    await bothBoards(w, (g) => g.outcome !== 'ongoing');
  }
);
Given(
  "{actor}'s {word} matched game with {actor} was aborted",
  async (w, first: string, clock: string, second: string) => {
    await abortedAt(w, first, second, clock);
  }
);

When('{int} second(s) pass(es)', async (w, seconds: number) => {
  await w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
});
When('{actor} resigns the matched game', async (w, actor: string) => {
  await resignation(w, actor);
});
When('{actor} aborts the matched game', async (w, actor: string) => {
  await gameCommand(w, actor, 'abortMultiplayer');
});
When('{actor} finds a new opponent', async (w, actor: string) => {
  await gameCommand(w, actor, 'findNewChessOpponent');
});

Then(
  'both people (still )see {actor} won the matched game',
  (w, actor: string) => winner(w, actor)
);
Then('both people see the matched game was aborted', async (w) => {
  expect((await bothBoards(w, (g) => g.outcome === 'aborted')).outcome).toBe(
    'aborted'
  );
});
Then('the matched game is still unfinished', async (w) => {
  expect((await bothBoards(w)).outcome).toBe('ongoing');
});
Then('{actor} is told the matched game is over', (w, actor: string) =>
  told(w, actor, 'CHESS_GAME_OVER')
);
