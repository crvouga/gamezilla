import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import { findGameOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

Given(
  '{actor} has found a chess opponent for {word}',
  (w, actor: Actor, timeControl: string) =>
    w.s.apply(findGameOpponent, actor, CHESS_GAME_ID, timeControl)
);
