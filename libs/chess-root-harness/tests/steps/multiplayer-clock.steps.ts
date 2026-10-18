import { expect } from 'bun:test';
import {
  givenMultiplayerClock,
  givenMultiplayerPosition,
} from '@libs/game-matchmaking-harness/matched-game-fixtures';
import {
  bothBoards,
  matchedGameOf,
  sameBoards,
  winner,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { givenGame } from './multiplayer-world';

/** White to move with a rook; Black down to the pieces the scenario names. */
async function lastPieces(
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
    const game = await matchedGameOf(w, actor);
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
  'the multiplayer game is still won by {actor} because White ran out of time',
  whiteFlagged
);
