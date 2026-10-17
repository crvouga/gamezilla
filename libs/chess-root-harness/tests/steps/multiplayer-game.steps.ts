import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  acceptedMoves,
  boardBeforeMove,
  bothBoards,
  matchedGameOf,
  pairOf,
  refusal,
  resignation,
  sameBoards,
  winner,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { Given, Then, When } from '@libs/harness/define';
import { accountIdOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  givenBegunGame,
  givenGame,
  givenOverGame,
  playOnOwnBoard,
} from './multiplayer-world';

Given(
  '{actor} is White and {actor} is Black in a new multiplayer game',
  givenGame
);
Given(
  '{actor} is White and {actor} is Black in a new {word} multiplayer game',
  givenGame
);
Given(
  '{actor} is White and {actor} is Black in a {word} multiplayer game after e4 and e5',
  givenBegunGame
);
Given('{actor} has an unfinished multiplayer game with {actor}', givenGame);
Given(
  '{actor} and {actor} have a multiplayer game from a matchmaking match',
  givenGame
);
Given(
  "{actor}'s multiplayer game with {actor} is over",
  (w, a: Actor, b: Actor) => givenOverGame(w, a, b)
);
Given("{actor}'s multiplayer move e2 to e4 was accepted", async (w) => {
  await givenGame(w);
  await acceptedMoves(w, ['e2e4']);
});
Given(
  '{actor} resigned multiplayer chess and {actor} won',
  async (w, loser: Actor, win: Actor) => {
    if (!w.memo.has('multiplayer:game')) {
      await givenOverGame(w, win, loser);
      return;
    }
    expect((await resignation(w, loser)).result.ok).toBe(true);
    await bothBoards(w, (g) => g.outcome !== 'ongoing');
  }
);
Given(
  '{actor} resigned multiplayer chess after the multiplayer moves e4 and e5',
  (w, loser: Actor) => givenOverGame(w, 'alice', loser)
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
    await playOnOwnBoard(w, actor, from + to);
  }
);
When('{actor} resigns multiplayer chess', async (w, actor: Actor) => {
  await resignation(w, actor);
});

Then('both multiplayer boards show the white pawn on e4', async (w) => {
  const game = await bothBoards(w, (g) => g.revision === 1);
  expect(game.fen).toStartWith(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b'
  );
});
Then('{actor} has the multiplayer turn', async (w, actor: Actor) => {
  const owner = await w.s.read(accountIdOf, actor);
  expect((await bothBoards(w)).turn).toBe(owner!);
});

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// The position the boards had when the refused move was tried, or the
// position every game starts from when nobody tried one.
Then('both multiplayer boards keep their starting position', async (w) => {
  expect((await bothBoards(w)).fen).toBe(boardBeforeMove(w)?.fen ?? START);
});
Then('both multiplayer boards still show two moves', async (w) => {
  expect((await bothBoards(w)).revision).toBe(2);
});
Then('{actor} is told it is not their multiplayer turn', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_NOT_YOUR_TURN')
);
Then('{actor} is told that multiplayer move is illegal', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_ILLEGAL_MOVE')
);
Then('{actor} is told the multiplayer game is over', (w, actor: Actor) =>
  refusal(w, actor, 'CHESS_GAME_OVER')
);
Then('both people see {actor} won the multiplayer game', (w, actor: Actor) =>
  winner(w, actor)
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
    expect((await sameBoards(w, actor, other)).id).toBe(
      (w.memo.get('multiplayer:game') as MultiplayerGame).id
    );
    expect(await matchedGameOf(w, other)).toEqual(
      await matchedGameOf(w, actor)
    );
  }
);

/** The move list a person sees on their multiplayer screen. */
async function moveListSeen(w: HarnessWorld, actor: string, moves: string) {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (
        await shownMultiplayerText(s, actor, 'multiplayer-move-list')
      )?.trim() === moves
  );
  expect(
    (
      await w.s.read(shownMultiplayerText, actor, 'multiplayer-move-list')
    )?.trim()
  ).toBe(moves);
}

async function bothSeeMoveList(w: HarnessWorld, moves: string) {
  for (const actor of pairOf(w)) await moveListSeen(w, actor, moves);
}

Then('both people see the multiplayer move list {string}', bothSeeMoveList);

Then(
  '{actor}, {actor} and {actor} see the multiplayer move list {string}',
  async (w, ...named: [Actor, Actor, Actor, string]) => {
    const [first, second, third, moves] = named;
    await moveListSeen(w, first, moves);
    await moveListSeen(w, second, moves);
    await moveListSeen(w, third, moves);
  }
);

Then(
  '{actor} sees the multiplayer move list {string}',
  (w, actor: Actor, moves: string) =>
    moveListSeen(
      w,
      String(w.memo.get(`multiplayer:other:${actor}`) ?? actor),
      moves
    )
);
