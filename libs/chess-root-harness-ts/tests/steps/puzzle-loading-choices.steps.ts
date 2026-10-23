import { expect } from 'bun:test';
import {
  askToStopPuzzleLoading,
  cancelStoppingPuzzleLoading,
  confirmStoppingPuzzleLoading,
  controlStoppingPuzzleLoading,
  leavePuzzleLoading,
  readStopPuzzleChoice,
} from '@libs/chess-root-harness-ts/lichess-file-actions';
import { preparePuzzleImport } from '@libs/chess-root-harness-ts/puzzle-import-setup';
import { readPuzzleImport } from '@libs/chess-root-harness-ts/puzzle-import-ui';
import {
  advancePuzzleImport,
  failPuzzleImport,
  finishPuzzleImport,
} from '@libs/chess-root-harness-ts/puzzle-import-world';
import { preparePuzzleStopChoice } from '@libs/chess-root-harness-ts/puzzle-stop-choice';
import { failStoppingPuzzleLoading } from '@libs/chess-root-harness-ts/puzzle-stop-failure';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

async function confirming(w: HarnessWorld, actor: Actor) {
  await w.s.apply(preparePuzzleImport);
  await w.s.apply(advancePuzzleImport);
  await w.s.apply(askToStopPuzzleLoading, actor);
}
Given('{actor} is being asked to confirm stopping adding puzzles', confirming);
Given(
  '{actor} has confirmed stopping and the stop has not finished',
  async (w, actor: Actor) => {
    await confirming(w, actor);
    await w.s.apply(controlStoppingPuzzleLoading, 'hold', actor);
    await w.s.apply(confirmStoppingPuzzleLoading, actor);
  }
);
Given(
  'adding puzzles finished while {actor} was being asked to confirm stopping',
  async (w, actor: Actor) => {
    await confirming(w, actor);
    await w.s.apply(finishPuzzleImport);
  }
);
When('{actor} asks to stop adding puzzles', (w, actor: Actor) =>
  w.s.apply(askToStopPuzzleLoading, actor)
);
When('{actor} cancels stopping adding puzzles', (w, actor: Actor) =>
  w.s.apply(cancelStoppingPuzzleLoading, actor)
);
When('{actor} confirms stopping adding puzzles', (w, actor: Actor) =>
  w.s.apply(confirmStoppingPuzzleLoading, actor)
);
When('stopping adding puzzles finishes', (w) =>
  w.s.apply(controlStoppingPuzzleLoading, null)
);
When('stopping adding puzzles fails', async (w) => {
  await w.s.apply(failStoppingPuzzleLoading);
  await w.s.apply(confirmStoppingPuzzleLoading);
});
When('{actor} asks to stop saving the Lichess file', (w, actor: Actor) =>
  w.s.apply(askToStopPuzzleLoading, actor)
);
When('{actor} cancels stopping the Lichess file save', (w, actor: Actor) =>
  w.s.apply(cancelStoppingPuzzleLoading, actor)
);
When('{actor} confirms stopping the Lichess file save', (w, actor: Actor) =>
  w.s.apply(confirmStoppingPuzzleLoading, actor)
);
Then(
  '{actor} is asked to confirm stopping adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      confirming: true,
    });
  }
);
Then(
  '{actor} is not asked to confirm stopping adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      confirming: false,
    });
  }
);
Then(
  '{actor} is told adding puzzles is being stopped',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      stopping: true,
    });
  }
);
Then(
  '{actor} is not offered to confirm stopping adding puzzles again',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      confirmEnabled: false,
    });
  }
);
Then(
  '{actor} is told adding puzzles could not be stopped and why',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      failed: true,
      text: expect.stringContaining('Unknown operation'),
    });
  }
);
Then(
  '{actor} is offered to confirm stopping adding puzzles again',
  async (w, actor: Actor) => {
    expect(await w.s.read(readStopPuzzleChoice, actor)).toMatchObject({
      failed: true,
    });
  }
);
Then(
  '{actor} sees that this environment finished adding puzzles',
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleImport, actor)).toMatchObject({
      status: 'finished',
    });
  }
);
Given('{actor} has left adding puzzles', (w, actor: Actor) =>
  w.s.apply(leavePuzzleLoading, actor)
);

Given(
  'adding puzzles failed while {actor} was being asked to confirm stopping',
  async (w, actor: Actor) => {
    await confirming(w, actor);
    await w.s.apply(failPuzzleImport);
  }
);

Given('{actor} could not stop an ongoing addition', async (w) => {
  await w.s.apply(preparePuzzleStopChoice, 'failed', true);
});
Given('{actor} has a successful stop confirmation', async (w, actor: Actor) => {
  await w.s.apply(preparePuzzleStopChoice, 'stopping', true);
  await w.s.apply(controlStoppingPuzzleLoading, null, actor);
});
