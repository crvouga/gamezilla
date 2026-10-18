import { expect } from 'bun:test';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import {
  goBackToGamePuzzles,
  leavePuzzleForGameChoices,
  readPuzzleBoardPosition,
  readPuzzleOnBoard,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { multiplayerPeople } from './multiplayer-people';
import { enterPuzzles, waitSolverToMove } from './puzzle-world';

Given(
  '{actor} and {actor} are playing a puzzle in a space',
  async (w, host: Actor, watcher: Actor) => {
    await prepareNamedFriend(w.s, host);
    await multiplayerPeople(w, [watcher]);
    await enterPuzzles(w, host);
    await waitSolverToMove(w, host);
    const puzzleId = await w.s.read(readPuzzleOnBoard, host);
    const puzzleFen = await w.s.read(readPuzzleBoardPosition, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error('Puzzle host has no space link');
    await w.s.apply(joinViaLink, watcher, link);
    await w.s.until(
      async (s) =>
        (await readPuzzleOnBoard(s, watcher)) === puzzleId &&
        (await readPuzzleBoardPosition(s, watcher)) === puzzleFen
    );
    w.memo.set('multiplayer:unrelated-puzzle', [
      await w.s.read(readPuzzleOnBoard, watcher),
      await w.s.read(readPuzzleBoardPosition, watcher),
    ]);
  }
);
When('{actor} returns to the puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(leavePuzzleForGameChoices, actor);
  await w.s.apply(goBackToGamePuzzles, actor);
});
Then('{actor} keeps the same puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect([
    await w.s.read(readPuzzleOnBoard, actor),
    await w.s.read(readPuzzleBoardPosition, actor),
  ]).toEqual(w.memo.get('multiplayer:unrelated-puzzle') as [string, string]);
});
