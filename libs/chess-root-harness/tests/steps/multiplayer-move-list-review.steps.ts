import { expect } from 'bun:test';
import { chooseMultiplayerMove } from '@libs/chess-root-harness/chess-multiplayer-board';
import { viewerOf } from '@libs/game-matchmaking-harness/matched-game-world';
import { Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { MOVE_NAMED, ownBoardSeen } from './multiplayer-own-board-world';

When(
  '{actor} chooses {word} in the multiplayer move list',
  (w, actor: Actor, move: string) =>
    w.s.apply(chooseMultiplayerMove, viewerOf(w, actor), move)
);

Then(
  '{actor} hears she is reviewing the earlier position after {word} in the multiplayer game',
  async (w, actor: Actor, move: string) => {
    const shown = await ownBoardSeen(w, actor, { earlierPosition: true });
    expect(shown.told).toContain(
      `You are reviewing an earlier position, after ${String(MOVE_NAMED[move])}.`
    );
  }
);
