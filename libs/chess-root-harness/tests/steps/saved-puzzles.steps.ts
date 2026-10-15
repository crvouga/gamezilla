import { expect } from 'bun:test';
import { saveLichessFileInAnotherEnvironment } from '@libs/chess-root-harness/puzzle-import-environments';
import { saveLichessFileFromSpace } from '@libs/chess-root-harness/puzzle-import-navigation';
import {
  noSavedLichessFile,
  readPuzzleSource,
  seedSavedLichessFile,
} from '@libs/chess-root-harness/puzzle-source-ui';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

Given('no Lichess file has been saved', (w) => w.s.apply(noSavedLichessFile));
Given('the team has saved a Lichess file', (w) =>
  w.s.apply(seedSavedLichessFile)
);
Given('the team has saved a Lichess file in another environment', (w) =>
  w.s.apply(saveLichessFileInAnotherEnvironment)
);
When('{actor} saves a Lichess file', async (w, actor: Actor) => {
  await w.s.apply(
    saveLichessFileFromSpace,
    actor,
    w.memo.get('puzzle-management:solver-space') as string
  );
});
Then(
  '{actor} is not asked to provide a Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      needsFile: false,
    });
  }
);
Then(
  '{actor} is asked to provide a Lichess file before adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saved: false,
      needsFile: true,
      chooseEnabled: true,
      saveOffered: true,
      startOffered: false,
    });
  }
);
Then(
  '{actor} is offered to add puzzles from the saved Lichess file',
  async (w, actor: Actor) => {
    expect(
      await w.s.until((s) => readPuzzleSource(s, actor), {
        pred: (source) => source.startOffered,
        maxMs: 15000,
      })
    ).toMatchObject({ saved: true, startOffered: true });
  }
);
Then(
  '{actor} is not offered to save another Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saved: true,
      saveOffered: false,
    });
  }
);
Then(
  '{actor} is told a connection is needed to save a Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saved: false,
      offline: true,
    });
  }
);
