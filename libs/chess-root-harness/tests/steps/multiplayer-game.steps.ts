import { expect } from 'bun:test';
import { givenMultiplayerPosition } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game';
import type { MultiplayerCommand } from '@libs/chess-root-harness/multiplayer-commands';
import { sendMultiplayerCommand } from '@libs/chess-root-harness/multiplayer-commands';
import { Given, Then, When } from '@libs/harness/define';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import {
  acceptedMoves,
  gameOf,
  givenGame,
  move,
  refusal,
  resignation,
  sameBoards,
  winner,
} from './multiplayer-world';

Given(
  '{actor} is White and {actor} is Black in a new multiplayer game',
  givenGame
);
Given('{actor} has an unfinished multiplayer game with {actor}', givenGame);
Given(
  '{actor} and {actor} have a multiplayer game from a matchmaking match',
  givenGame
);
Given(
  "{actor}'s multiplayer game with {actor} is over",
  async (w, a: Actor, b: Actor) => {
    await givenGame(w, a, b);
    await resignation(w, b);
    await sameBoards(w, a, b, (g) => g.outcome !== 'ongoing');
  }
);
Given("{actor}'s multiplayer move e2 to e4 was accepted", async (w) => {
  await givenGame(w);
  await acceptedMoves(w, ['e2e4']);
});
Given("{actor}'s multiplayer move e7 to e5 was accepted", async (w) => {
  const reply = await move(w, 'bob', 'e7e5');
  expect(reply.result.ok).toBe(true);
  await sameBoards(w, 'alice', 'bob', (g) => g.revision === 2);
});
Given(
  '{actor} resigned multiplayer chess and {actor} won',
  async (w, loser: Actor, win: Actor) => {
    await givenGame(w, win, loser);
    await resignation(w, loser);
    await sameBoards(w, win, loser, (g) => g.outcome !== 'ongoing');
  }
);
Given(
  '{actor} is White and {actor} is Black after multiplayer moves f3, e5, g4',
  async (w, a: Actor, b: Actor) => {
    await givenGame(w, a, b);
    await acceptedMoves(w, ['f2f3', 'e7e5', 'g2g4']);
  }
);
When(
  '{actor} plays {word} to {word} as a multiplayer move',
  async (w, actor: Actor, from: string, to: string) => {
    await move(w, actor, from + to);
  }
);
When('{actor} repeats that multiplayer move', async (w, actor: Actor) => {
  await w.s.apply(
    sendMultiplayerCommand,
    actor,
    w.memo.get(`multiplayer:last:${actor}`) as MultiplayerCommand
  );
});
When(
  '{actor} plays d2 to d4 for her earlier multiplayer position',
  async (w, actor: Actor) => {
    await move(w, actor, 'd2d4', 0);
  }
);
When('{actor} resigns multiplayer chess', async (w, actor: Actor) => {
  await resignation(w, actor);
});
When('{actor} resigns multiplayer chess again', async (w, actor: Actor) => {
  await resignation(w, actor);
});
Then('both multiplayer boards show the white pawn on e4', async (w) => {
  const game = await sameBoards(w, 'alice', 'bob', (g) => g.revision === 1);
  expect(game.fen).toStartWith(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b'
  );
});
Then('{actor} has the multiplayer turn', async (w, actor: Actor) => {
  const owner = await w.s.read(accountIdOf, actor);
  expect((await sameBoards(w)).turn).toBe(owner!);
});
Then('{actor} still has the multiplayer turn', async (w, actor: Actor) => {
  expect((await sameBoards(w)).turn).toBe(
    (await w.s.read(accountIdOf, actor))!
  );
});
Then('both multiplayer boards keep their starting position', async (w) => {
  expect((await sameBoards(w)).fen).toBe(
    (w.memo.get('multiplayer:game') as MultiplayerGame).fen
  );
  expect((await gameOf(w)).revision).toBe(0);
});
Then('both multiplayer boards show one move', async (w) => {
  expect((await sameBoards(w)).revision).toBe(1);
});
Then('both multiplayer boards still show two moves', async (w) => {
  expect((await sameBoards(w)).revision).toBe(2);
});
Then('{actor} is told it is not his multiplayer turn', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_NOT_YOUR_TURN')
);
Then('{actor} is told that multiplayer move is illegal', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_ILLEGAL_MOVE')
);
Then('{actor} is told her multiplayer board has changed', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_BOARD_CHANGED')
);
Then('{actor} is told the multiplayer game is over', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_GAME_OVER')
);
Then('both people see {actor} won the multiplayer game', (w, actor: Actor) =>
  winner(w, actor)
);
Then(
  'both people still see {actor} won the multiplayer game',
  (w, actor: Actor) => winner(w, actor)
);
Then(
  'both people see {actor} won the multiplayer game by checkmate',
  (w, actor: Actor) => winner(w, actor, 'checkmate')
);
Then(
  '{actor} and {actor} keep the same multiplayer game and board',
  async (w, a: Actor, b: Actor) => {
    expect(await sameBoards(w, a, b)).toEqual(
      w.memo.get('multiplayer:game') as MultiplayerGame
    );
  }
);
Then(
  '{actor} keeps her multiplayer game with {actor}',
  async (w, a: Actor, b: Actor) => {
    expect((await sameBoards(w, a, b)).id).toBe(
      (w.memo.get('multiplayer:game') as MultiplayerGame).id
    );
  }
);
Then(
  '{actor} sees the same multiplayer game and board on that device',
  async (w, actor: Actor) => {
    const other = String(w.memo.get(`multiplayer:other:${actor}`));
    expect(await sameBoards(w, actor, other)).toEqual(
      w.memo.get('multiplayer:game') as MultiplayerGame
    );
  }
);

const REPETITION = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1'];
Given(
  '{actor} and {actor} have a multiplayer position one move from {}',
  async (w, a: Actor, b: Actor, boundary: string) => {
    const game = await givenGame(w, a, b);
    if (
      boundary === 'its third appearance' ||
      boundary === 'its second appearance'
    ) {
      await acceptedMoves(
        w,
        REPETITION.slice(0, boundary === 'its third appearance' ? 7 : 3)
      );
      w.memo.set('multiplayer:boundary-move', ['bob', 'f6g8']);
      return;
    }
    const positions: Record<string, readonly [string, string]> = {
      stalemate: ['k7/8/1QK5/8/8/8/8/8 w - - 0 1', 'b6c7'],
      'insufficient mating material': [
        '7k/8/8/8/8/8/1n6/K1B5 w - - 0 1',
        'c1b2',
      ],
      'fifty moves without a pawn move or capture': [
        '7k/8/8/8/8/8/R7/K7 w - - 99 51',
        'a2b2',
      ],
    };
    const position = positions[boundary];
    if (position === undefined)
      throw new Error(`Unknown draw boundary ${boundary}`);
    await w.s.apply(givenMultiplayerPosition, a, game.id, position[0]);
    await sameBoards(w, a, b, (g) => g.fen === position[0]);
    w.memo.set('multiplayer:boundary-move', [a, position[1]]);
  }
);
When('the person whose turn it is plays that multiplayer move', async (w) => {
  const [actor, uci] = w.memo.get('multiplayer:boundary-move') as [
    string,
    string,
  ];
  await move(w, actor, uci);
});
Then(
  'both people see the multiplayer game is drawn by {}',
  async (w, reason: string) => {
    const game = await sameBoards(
      w,
      'alice',
      'bob',
      (g) => g.outcome === 'draw'
    );
    expect(game.reason).toBe(
      reason === 'insufficient mating material'
        ? 'insufficient material'
        : reason
    );
  }
);
Then('the multiplayer game is still unfinished', async (w) => {
  expect((await sameBoards(w)).outcome).toBe('ongoing');
});
