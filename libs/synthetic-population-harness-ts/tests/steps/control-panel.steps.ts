import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import {
  controlPanelOffered,
  onlineNowRow,
} from '@libs/observatory-actions-harness-ts/user-observatory-actions';
import {
  directoryControlPanelOffered,
  givenPausedSyntheticUsers,
  pauseEverySyntheticUser,
  restartSyntheticUser,
  resumeEverySyntheticUser,
  resumeSyntheticUser,
  syntheticUserAvailableShown,
  syntheticUserPausedShown,
} from '@libs/synthetic-population-harness-ts/control-panel-actions';
import { rememberContinuity } from './continuity-memo';

const SECOND_MS = 1_000;
const SHOWN_MS = 10_000;
/** Whoever is looking: the person a scenario authorized. */
const OBSERVER = 'alice';

Given('the Synthetic User {string} is paused', async (w, name: string) => {
  await w.s.apply(givenPausedSyntheticUsers, [name]);
});
Given(
  'the Synthetic Users {string} and {string} are paused',
  async (w, first: string, second: string) => {
    await w.s.apply(givenPausedSyntheticUsers, [first, second]);
  }
);

When('{actor} pauses every Synthetic User', async (w, actor: Actor) => {
  await w.s.apply(pauseEverySyntheticUser, actor);
});
When('{actor} resumes every Synthetic User', async (w, actor: Actor) => {
  await w.s.apply(resumeEverySyntheticUser, actor);
});
When(
  '{actor} resumes the Synthetic User {string}',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(resumeSyntheticUser, actor, name);
  }
);
When(
  '{actor} restarts the Synthetic User {string}',
  async (w, actor: Actor, name: string) => {
    await rememberContinuity(w);
    await w.s.apply(restartSyntheticUser, actor, name);
  }
);

Then(
  '{actor} is offered the control panel of {string}',
  async (w, actor: Actor, name: string) => {
    await w.s.until((s) => directoryControlPanelOffered(s, actor, name), {
      pred: Boolean,
      maxMs: SHOWN_MS,
    });
  }
);
Then(
  '{actor} is not offered a control panel for {actor}',
  async (w, actor: Actor, person: Actor) => {
    await w.s.until((s) => onlineNowRow(s, actor, person), {
      pred: (row) => row !== null,
      maxMs: SHOWN_MS,
    });
    expect(await w.s.read(controlPanelOffered, actor, person)).toBe(false);
  }
);
Then(
  'the Synthetic Users {string} and {string} are available within {int} seconds',
  async (w, first: string, second: string, seconds: number) => {
    await w.s.until((s) => syntheticUserAvailableShown(s, OBSERVER, first), {
      pred: Boolean,
      maxMs: seconds * SECOND_MS,
    });
    await w.s.until((s) => syntheticUserAvailableShown(s, OBSERVER, second), {
      pred: Boolean,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then(
  'the Synthetic User {string} is available within {int} seconds',
  async (w, name: string, seconds: number) => {
    await w.s.until((s) => syntheticUserAvailableShown(s, OBSERVER, name), {
      pred: Boolean,
      maxMs: seconds * SECOND_MS,
    });
  }
);
Then('{string} is still paused', async (w, name: string) => {
  expect(await w.s.read(syntheticUserPausedShown, OBSERVER, name)).toBe(true);
});
