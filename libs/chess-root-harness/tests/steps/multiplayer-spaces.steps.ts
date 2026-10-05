import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { joinMultiplayerSpace, multiplayerWatcherBoard } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { leaveSpace } from '@libs/spaces-harness/space-actions';
import { givenGame, refusal } from './multiplayer-world';

Given('{actor} is outside a space', async (w, actor: Actor) => {
  await w.s.apply(leaveSpace, actor);
});
Given('{actor} is hosting another space', async (w, actor: Actor) => {
  await w.s.apply(givenMultiplayerSpace, actor);
});
Given('{actor} and {actor} have a multiplayer game in different spaces', async (w, first: Actor, second: Actor) => {
  await givenGame(w, first, second);
  await w.s.apply(openMultiplayerChess, first);
  await w.s.apply(openMultiplayerChess, second);
});
Given("{actor} is a guest watching {actor}'s multiplayer game", async (w, watcher: Actor, host: Actor) => {
  await w.s.apply(openMultiplayerChess, host);
  await w.s.apply(joinMultiplayerSpace, watcher, host);
  w.memo.set(`multiplayer:watcher:${watcher}`, true);
});
When("{actor} joins {actor}'s space", async (w, watcher: Actor, host: Actor) => {
  await w.s.apply(openMultiplayerChess, host);
  await w.s.apply(joinMultiplayerSpace, watcher, host);
});
Then('{actor} is told multiplayer chess needs a space', (w, actor: Actor) => refusal(w, actor, 'CHESS_SPACE_REQUIRED'));
Then('{actor} is told only the matched people can move multiplayer pieces', (w, actor: Actor) => refusal(w, actor, 'CHESS_MATCHED_ONLY'));
async function pawn(w: import('@libs/harness/spec-world').HarnessWorld, actor: Actor) {
  await w.s.until(async s => (await multiplayerWatcherBoard(s, actor)).fen?.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR') === true);
}
async function watcher(w: import('@libs/harness/spec-world').HarnessWorld, actor: Actor) {
  const board = await w.s.read(multiplayerWatcherBoard, actor);
  expect(board.watching).toBe(true);
  expect(board.canResign).toBe(false);
}
Then('{actor} and {actor} see the multiplayer pawn on e4', async (w, first: Actor, second: Actor) => { await pawn(w, first); await pawn(w, second); });
Then('{actor} sees the multiplayer pawn on e4', pawn);
Then('{actor} and {actor} cannot move multiplayer pieces', async (w, first: Actor, second: Actor) => { await watcher(w, first); await watcher(w, second); });
Then('{actor} cannot move multiplayer pieces', watcher);
