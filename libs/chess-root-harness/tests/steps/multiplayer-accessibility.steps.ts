import { moveMultiplayerPieceWithKeyboard } from '@libs/chess-root-harness/chess-multiplayer-board';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  bothBoards,
  matchedGameOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
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
Given(
  '{actor} is listening to her {word} multiplayer game with {actor} after e4 and e5',
  async (w, actor: Actor, timeControl: string, opponent: Actor) => {
    await givenBegunGame(w, actor, opponent, timeControl);
    await w.s.apply(openFindingAnOpponent, actor, CHESS_GAME_ID);
  }
);
When(
  '{actor} plays {word} to {word} as a multiplayer move with the keyboard',
  async (w, actor: Actor, from: string, to: string) => {
    const before = (await matchedGameOf(w, actor)).revision;
    await w.s.apply(moveMultiplayerPieceWithKeyboard, actor, from + to);
    await bothBoards(w, (g) => g.revision === before + 1);
  }
);
