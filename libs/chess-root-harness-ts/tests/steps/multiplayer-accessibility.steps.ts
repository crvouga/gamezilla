import { moveMultiplayerPieceWithKeyboard } from '@libs/chess-root-harness-ts/chess-multiplayer-board';
import {
  bothBoards,
  matchedGameOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { Given, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { multiplayerPeople } from './multiplayer-people';
import { givenBegunGame } from './multiplayer-world';

Given(
  '{actor} has an account and is using the keyboard alone',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
  }
);
Given(
  '{actor} is White after e4 and e5 in a {word} multiplayer game and is using the keyboard alone',
  (w, actor: Actor, timeControl: string) =>
    givenBegunGame(w, actor, 'bob', timeControl)
);
When(
  '{actor} plays {word} to {word} as a multiplayer move with the keyboard',
  async (w, actor: Actor, from: string, to: string) => {
    const before = (await matchedGameOf(w, actor)).revision;
    await w.s.apply(moveMultiplayerPieceWithKeyboard, actor, from + to);
    await bothBoards(w, (g) => g.revision === before + 1);
  }
);
