import { expect } from 'bun:test';
import { readStopPuzzleChoice } from '@libs/chess-root-harness-ts/lichess-file-actions';
import {
  readOtherPuzzleSource,
  refreshOtherPuzzleSource,
} from '@libs/chess-root-harness-ts/puzzle-import-environments';
import { readPuzzleSource } from '@libs/chess-root-harness-ts/puzzle-source-ui';
import { Then } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

Then(
  '{actor} is told the saved Lichess file is being checked',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      checking: true,
      needsFile: false,
    });
  }
);
Then('{actor} is not offered to add puzzles', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
    startOffered: false,
  });
});
Then(
  '{actor} is told the saved Lichess file could not be checked',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      checkFailed: true,
    });
  }
);
Then(
  '{actor} is offered to check for the saved Lichess file again',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      checkAgainOffered: true,
    });
  }
);
Then(
  '{actor} is told a connection is needed to check for the saved Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      offline: true,
    });
  }
);
Then('{actor} is not shown the saved Lichess file', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
    saved: false,
  });
});
Then(
  '{actor} is not offered to save a Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saveEnabled: false,
    });
  }
);
Then(
  '{actor} is offered to save the chosen Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saveEnabled: true,
    });
  }
);
Then(
  '{actor} is not offered to save a Lichess file without choosing one',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saveEnabled: false,
    });
  }
);
Then(
  '{actor} can see that the Lichess file is being saved',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saving: true,
      progressVisible: true,
    });
  }
);
Then(
  '{actor} is not offered to choose another Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      chooseEnabled: false,
    });
  }
);
Then('{actor} is offered to choose a Lichess file', async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
    chooseEnabled: true,
  });
});
Then(
  '{actor} is told the file could not be saved and why',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saveFailed: true,
      saveError: expect.any(String),
    });
  }
);

Then(
  '{actor} is told saving the Lichess file stopped',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saving: false,
      saveError: expect.stringContaining('Saving stopped'),
    });
  }
);
Then(
  '{actor} is told the Lichess file could not finish saving without a connection',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saving: false,
      offline: true,
      saveFailed: true,
    });
  }
);
Then(
  '{actor} still sees the same saved Lichess file',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saved: true,
      filename: expect.any(String),
    });
    expect((await w.s.read(readPuzzleSource, actor)).filename).toBe(
      String(w.memo.get('lichess:file-seen') ?? 'Saved Lichess filelichess.csv')
    );
  }
);
Then(
  '{actor} is offered the Lichess file already saved by the team',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      saved: true,
      filename: expect.stringContaining('lichess.csv'),
      startOffered: true,
    });
    expect((await w.s.read(readPuzzleSource, actor)).filename).not.toContain(
      'alice-lichess'
    );
  }
);
Then(
  "the other environment's saved Lichess file has not been replaced",
  async (w) => {
    await w.s.apply(refreshOtherPuzzleSource);
    expect(await w.s.read(readOtherPuzzleSource)).toMatchObject({
      saved: true,
      filename: expect.stringContaining('lichess.csv'),
    });
  }
);
Then(
  'the other environment does not offer the unfinished Lichess file',
  async (w) => {
    await w.s.apply(refreshOtherPuzzleSource);
    expect(await w.s.read(readOtherPuzzleSource)).toMatchObject({
      saved: false,
      needsFile: true,
    });
  }
);
Then('the other environment is not adding puzzles', async (w) => {
  expect(await w.s.read(readOtherPuzzleSource)).toMatchObject({
    startOffered: false,
  });
});
Then(
  '{actor} is asked to confirm stopping the Lichess file save',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      confirming: true,
    });
  }
);
Then(
  '{actor} is not asked to confirm stopping the Lichess file save',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      confirming: false,
    });
  }
);

Then(
  '{actor} is not offered to check for the saved Lichess file again',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleSource, actor)).toMatchObject({
      checkAgainEnabled: false,
    });
  }
);
