import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { passMultiplayerTime } from '@libs/chess-matchmaking-harness/multiplayer-time';
import {
  givenMultiplayerClock,
  givenMultiplayerPosition,
} from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { shownMultiplayerClock } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { clockLeftMs } from '@libs/game-matchmaking-shared/multiplayer-clock';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  bothBoards,
  gameOf,
  givenGame,
  ownerOf,
  pairOf,
  sameBoards,
  winner,
} from './multiplayer-world';

async function personClocks(
  w: HarnessWorld,
  actor: string,
  white: number,
  black: number
) {
  await w.s.apply(openMultiplayerChess, actor);
  await w.s.until(
    async (s) =>
      (await shownMultiplayerClock(s, actor, 'white')) === white &&
      (await shownMultiplayerClock(s, actor, 'black')) === black,
    { maxMs: 500 }
  );
  expect([
    await w.s.read(shownMultiplayerClock, actor, 'white'),
    await w.s.read(shownMultiplayerClock, actor, 'black'),
  ]).toEqual([white, black]);
}

async function clocksSeen(w: HarnessWorld, white: number, black: number) {
  for (const actor of pairOf(w)) await personClocks(w, actor, white, black);
}

Then(
  "both people see {int} seconds on White's multiplayer clock and {int} seconds on Black's",
  clocksSeen
);

Then(
  "{actor}, {actor} and {actor} see {int} seconds on White's multiplayer clock and {int} seconds on Black's",
  async (w, ...named: [Actor, Actor, Actor, number, number]) => {
    const [first, second, third, white, black] = named;
    await personClocks(w, first, white, black);
    await personClocks(w, second, white, black);
    await personClocks(w, third, white, black);
  }
);

Given("White's multiplayer clock has run out", async (w) => {
  const [white] = pairOf(w);
  const game = await gameOf(w, white);
  const now = await w.s.read((s) => s.harness.clock.now());
  await w.s.apply(passMultiplayerTime, clockLeftMs(game, 'white', now));
});

/** White to move with a rook; Black down to the pieces the scenario names. */
export async function lastPieces(
  w: HarnessWorld,
  people: { readonly white: string; readonly black: string },
  timeControl: string,
  fen: string
) {
  const game = await givenGame(w, people.white, people.black, timeControl);
  await w.s.apply(givenMultiplayerPosition, people.white, {
    gameId: game.id,
    fen,
  });
  await sameBoards(w, people.white, people.black, (g) => g.fen === fen);
}
Given(
  '{actor} has only his king left as Black in his {word} multiplayer game with {actor}',
  (w, black: Actor, timeControl: string, white: Actor) =>
    lastPieces(
      w,
      { white, black },
      timeControl,
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 40'
    )
);
Given(
  '{actor} has only his king and a knight left as Black in his {word} multiplayer game with {actor}',
  (w, black: Actor, timeControl: string, white: Actor) =>
    lastPieces(
      w,
      { white, black },
      timeControl,
      '4k3/8/8/8/8/2n5/8/R3K3 w - - 0 40'
    )
);
Given(
  "{actor} has {int} second left on White's multiplayer clock on her turn",
  async (w, actor: Actor, seconds: number) => {
    const game = await gameOf(w, actor);
    await w.s.apply(givenMultiplayerClock, actor, {
      gameId: game.id,
      side: 'white',
      ms: seconds * 1000,
    });
    await bothBoards(w, (g) => g.white_ms === seconds * 1000);
  }
);

async function whiteFlagged(w: HarnessWorld, actor: string) {
  await winner(w, actor, 'timeout');
  expect((await bothBoards(w)).white_ms).toBe(0);
}

Then(
  'both people see {actor} won the multiplayer game because White ran out of time',
  whiteFlagged
);
Then(
  'the multiplayer game is still won by {actor} because White ran out of time',
  whiteFlagged
);
Then(
  '{actor} sees he won the multiplayer game because White ran out of time',
  async (w, actor: Actor) => {
    const owner = await ownerOf(w, actor);
    const game = await sameBoards(
      w,
      actor,
      actor,
      (g) => g.outcome !== 'ongoing'
    );
    expect(game.outcome).toBe(game.black_id === owner ? 'black' : 'white');
    expect(game.reason).toBe('timeout');
  }
);
