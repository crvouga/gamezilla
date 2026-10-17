import { expect } from 'bun:test';
import {
  leavePuzzleToChessMenu,
  reopenPuzzleFromChessMenu,
} from '@libs/chess-puzzle-harness/chess-actions';
import {
  readActivePuzzleId,
  readPuzzleDisplayFen,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { multiplayerPeople } from './multiplayer-people';
import { enterPuzzles, waitSolverToMove } from './puzzle-world';

Then(
  '{actor} is still looking for a chess opponent',
  async (w, actor: Actor) => {
    expect((await w.s.read(multiplayerView, actor)).search?.standing).toBe(
      'waiting'
    );
  }
);
Given(
  '{actor} and {actor} are playing a puzzle in a space',
  async (w, host: Actor, watcher: Actor) => {
    await prepareNamedFriend(w.s, host);
    await multiplayerPeople(w, [watcher]);
    await enterPuzzles(w, host);
    await waitSolverToMove(w, host);
    const puzzleId = await w.s.read(readActivePuzzleId, host);
    const puzzleFen = await w.s.read(readPuzzleDisplayFen, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error('Puzzle host has no space link');
    await w.s.apply(joinViaLink, watcher, link);
    await w.s.until(
      async (s) =>
        (await readActivePuzzleId(s, watcher)) === puzzleId &&
        (await readPuzzleDisplayFen(s, watcher)) === puzzleFen
    );
    w.memo.set('multiplayer:unrelated-puzzle', [
      await w.s.read(readActivePuzzleId, watcher),
      await w.s.read(readPuzzleDisplayFen, watcher),
    ]);
  }
);
When('{actor} returns to the puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(leavePuzzleToChessMenu, actor);
  await w.s.apply(reopenPuzzleFromChessMenu, actor);
});
Then('{actor} keeps the same puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect([
    await w.s.read(readActivePuzzleId, actor),
    await w.s.read(readPuzzleDisplayFen, actor),
  ]).toEqual(w.memo.get('multiplayer:unrelated-puzzle') as [string, string]);
});
