import { expect } from 'bun:test';
import {
  flipMultiplayerBoard,
  nearestMultiplayerSeat,
} from '@libs/chess-matchmaking-harness/multiplayer-own-board';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { ownBoardSeen } from './multiplayer-own-board-world';
import { bothBoards, ownerOf } from './multiplayer-world';

/** `White` or `Black`, as a scenario names the side a board faces. */
function sideNamed(name: string): 'white' | 'black' {
  if (name !== 'White' && name !== 'Black')
    throw new Error(`a board faces White or Black, not "${name}"`);
  return name === 'White' ? 'white' : 'black';
}

When('{actor} flips the board', (w, actor: Actor) =>
  w.s.apply(flipMultiplayerBoard, actor)
);
Given('{actor} has flipped the board', (w, actor: Actor) =>
  w.s.apply(flipMultiplayerBoard, actor)
);

Then(
  "{actor}'s multiplayer board faces {word}",
  async (w, actor: Actor, side: string) => {
    await ownBoardSeen(w, actor, { facing: sideNamed(side) });
  }
);
Then(
  "{actor} sees {actor}'s name, multiplayer rating and multiplayer clock nearest her",
  async (w, actor: Actor, opponent: Actor) => {
    const game = await bothBoards(w);
    const black = game.black_id === (await ownerOf(w, opponent));
    expect(await w.s.read(nearestMultiplayerSeat, actor)).toEqual({
      opponent: `${opponent} (${String(black ? game.black_rating : game.white_rating)})`,
      clock: black ? 'black' : 'white',
    });
  }
);
