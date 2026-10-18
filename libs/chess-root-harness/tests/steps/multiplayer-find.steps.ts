import { findChessOpponent } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

Given(
  '{actor} has found a chess opponent for {word}',
  (w, actor: Actor, timeControl: string) =>
    w.s.apply(findChessOpponent, actor, timeControl)
);
