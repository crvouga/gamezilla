import { expect } from 'bun:test';
import {
  chooseMultiplayerMove,
  goToMultiplayerStart,
  returnToCurrentPosition,
  stepMultiplayerMoves,
} from '@libs/chess-matchmaking-harness/multiplayer-own-board';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  MOVE_NAMED,
  ownBoardSeen,
  piecesAfter,
} from './multiplayer-own-board-world';
import { acceptedMoves, viewerOf } from './multiplayer-world';

/** The person's board shows the position after the move, earlier or current. */
function positionSeen(
  w: HarnessWorld,
  actor: string,
  position: { readonly after: string; readonly earlier: boolean }
) {
  return ownBoardSeen(w, actor, {
    pieces: piecesAfter(position.after),
    earlierPosition: position.earlier,
    canMovePiece: position.earlier ? false : undefined,
  });
}

/** The person chose the move and their board shows the position after it. */
async function reviewing(w: HarnessWorld, actor: string, move: string) {
  await w.s.apply(chooseMultiplayerMove, viewerOf(w, actor), move);
  await positionSeen(w, actor, { after: move, earlier: true });
}

Given(
  '{actor} is reviewing the earlier position after {word} in the multiplayer game',
  reviewing
);
Given(
  "{actor} was reviewing the earlier position after {word} in the multiplayer game when {actor}'s move Nf3 was accepted",
  async (w, actor: Actor, move: string, _mover: Actor) => {
    await reviewing(w, actor, move);
    await acceptedMoves(w, ['g1f3']);
    await positionSeen(w, actor, { after: move, earlier: true });
  }
);

When(
  '{actor} chooses {word} in the multiplayer move list',
  (w, actor: Actor, move: string) =>
    w.s.apply(chooseMultiplayerMove, viewerOf(w, actor), move)
);
When(
  "{actor} steps back one move in the multiplayer move list with the keyboard's left arrow",
  (w, actor: Actor) =>
    w.s.apply(stepMultiplayerMoves, viewerOf(w, actor), 'back', true)
);
When(
  "{actor} steps forward one move in the multiplayer move list with the keyboard's right arrow",
  (w, actor: Actor) =>
    w.s.apply(stepMultiplayerMoves, viewerOf(w, actor), 'forward', true)
);
When(
  '{actor} goes to the start of the multiplayer move list',
  (w, actor: Actor) => w.s.apply(goToMultiplayerStart, viewerOf(w, actor))
);
When(
  '{actor} returns to the current position in the multiplayer game',
  (w, actor: Actor) => w.s.apply(returnToCurrentPosition, viewerOf(w, actor))
);

Then(
  "{actor}'s multiplayer board (still )shows the earlier position after {word}",
  async (w, actor: Actor, move: string) => {
    await positionSeen(w, actor, { after: move, earlier: true });
  }
);
Then(
  "{actor}'s multiplayer board (still )shows the current position after {word}",
  async (w, actor: Actor, move: string) => {
    await positionSeen(w, actor, { after: move, earlier: false });
  }
);
Then(
  "{actor}'s multiplayer board shows the earlier position at the start of the game",
  async (w, actor: Actor) => {
    await positionSeen(w, actor, { after: 'start', earlier: true });
  }
);
Then(
  '{actor} cannot review an earlier position in the multiplayer game',
  async (w, actor: Actor) => {
    await positionSeen(w, actor, { after: 'start', earlier: false });
  }
);
Then(
  '{actor} is told she is reviewing an earlier position in the multiplayer game',
  async (w, actor: Actor) => {
    const shown = await ownBoardSeen(w, actor, { earlierPosition: true });
    expect(shown.told).toContain('You are reviewing an earlier position');
    expect(shown.told).toContain('No piece can be moved on it');
  }
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
