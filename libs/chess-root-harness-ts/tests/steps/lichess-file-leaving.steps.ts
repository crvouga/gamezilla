import { expect } from 'bun:test';
import {
  askToLeaveAddingPuzzles,
  cancelLeavingAddingPuzzles,
  confirmLeavingAddingPuzzles,
  prepareChoosingLichessDeparture,
  readLichessDeparture,
} from '@libs/chess-root-harness-ts/lichess-file-departure';
import { followPuzzleImport } from '@libs/chess-root-harness-ts/puzzle-import-ui';
import { readPuzzleSource } from '@libs/chess-root-harness-ts/puzzle-source-ui';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

Given(
  '{actor} is choosing whether to leave while saving a Lichess file',
  (w, actor: Actor) =>
    w.s.apply(
      prepareChoosingLichessDeparture,
      actor,
      w.memo.get('puzzle-management:solver-space') as string
    )
);
When('{actor} asks to leave adding puzzles', (w, actor: Actor) =>
  w.s.apply(askToLeaveAddingPuzzles, actor)
);
When('{actor} cancels leaving adding puzzles', (w, actor: Actor) =>
  w.s.apply(cancelLeavingAddingPuzzles, actor)
);
When('{actor} confirms leaving adding puzzles', (w, actor: Actor) =>
  w.s.apply(confirmLeavingAddingPuzzles, actor)
);

Then(
  '{actor} is asked to confirm leaving because the Lichess file is still being saved',
  async (w, actor: Actor) => {
    expect(await w.s.read(readLichessDeparture, actor)).toMatchObject({
      followingAddingPuzzles: true,
      leavingAddingPuzzles: true,
      savingLichessFile: true,
    });
  }
);
Then(
  '{actor} is not asked to confirm leaving adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readLichessDeparture, actor)).toMatchObject({
      leavingAddingPuzzles: false,
    });
  }
);
Then('{actor} is away from adding puzzles', async (w, actor: Actor) => {
  expect(await w.s.read(readLichessDeparture, actor)).toMatchObject({
    followingAddingPuzzles: false,
    leavingAddingPuzzles: false,
    savingLichessFile: false,
  });
});
Then(
  'the team can still add puzzles from the saved Lichess file',
  async (w) => {
    await w.s.apply(followPuzzleImport, 'alice');
    expect(await w.s.read(readPuzzleSource, 'alice')).toMatchObject({
      saved: true,
      startOffered: true,
    });
  }
);
