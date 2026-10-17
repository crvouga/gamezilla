import { expect } from 'bun:test';
import {
  bothBoards,
  inMatchedGame,
  move,
  pairOf,
} from '@libs/game-matchmaking-harness/matched-game-world';
import {
  multiplayerView,
  shownMoveCount,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { refusedCustomGameMove } from './custom-game-play-world';
import { toldOf } from './custom-game-set-up-world';
import { gameOf } from './game-world';
import {
  actOnOtherDevice,
  firstMoveOf,
  otherDevice,
  refusedMove,
  seenOn,
  told,
} from './matched-game';

/** `person`'s other device, once it holds their matched game. */
async function otherDeviceWithGame(w: HarnessWorld, person: string) {
  const device = await otherDevice(w, person);
  actOnOtherDevice(w, person, device);
  await w.s.until((s) => multiplayerView(s, device), {
    pred: (view) => view.game !== null,
  });
  return device;
}

/** `device` shows `count` moves played on finding an opponent. */
async function movesSeen(w: HarnessWorld, device: string, count: number) {
  await w.s.apply(openFindingAnOpponent, device, gameOf(w).shared.id);
  await w.s.until((s) => shownMoveCount(s, device), {
    pred: (shown) => shown === count,
  });
  expect(await w.s.read(shownMoveCount, device)).toBe(count);
}

async function bothSeeMoves(w: HarnessWorld, count: number) {
  for (const person of pairOf(w)) await movesSeen(w, person, count);
}

When('{actor} makes his/her first move', async (w, actor: string) => {
  await move(w, actor, firstMoveOf(w, actor));
});
When(
  '{actor} makes her first move again on her other device',
  async (w, actor: string) => {
    const device = await otherDeviceWithGame(w, actor);
    await move(w, device, firstMoveOf(w, actor), 0);
  }
);
When(
  '{actor} makes a different first move on her other device still showing the starting board',
  async (w, actor: string) => {
    const rules = gameOf(w).shared.turnGame.rules;
    const different = rules
      .legal(rules.initial())
      .find((candidate) => candidate !== firstMoveOf(w, actor));
    if (different === undefined)
      throw new Error(`${gameOf(w).label} offers one first move only`);
    const device = await otherDeviceWithGame(w, actor);
    await move(w, device, different, 0);
  }
);
When('{actor} makes a move the game refuses', async (w, actor: string) => {
  if (inMatchedGame(w)) await move(w, actor, refusedMove(w));
  else await refusedCustomGameMove(w, actor);
});

Then(
  "both people see {actor}'s first move on the board",
  async (w, _actor: string) => {
    const game = await bothBoards(w, (g) => g.revision === 1);
    expect(game.revision).toBe(1);
    expect(game.fen).not.toBe(gameOf(w).shared.turnGame.rules.initial());
  }
);
Then('both people (still )see the one move played', (w) => bothSeeMoves(w, 1));
Then('both people (still )see the two moves played', (w) => bothSeeMoves(w, 2));
Then('{actor} sees the two moves played', (w, actor: string) =>
  movesSeen(w, seenOn(w, actor), 2)
);
Then('{actor} is told that move is not allowed', (w, actor: string) =>
  inMatchedGame(w)
    ? told(w, actor, 'CHESS_ILLEGAL_MOVE')
    : toldOf(w, actor, 'move is illegal')
);
Then('{actor} is told her board has changed', (w, actor: string) =>
  told(w, actor, 'CHESS_BOARD_CHANGED')
);
