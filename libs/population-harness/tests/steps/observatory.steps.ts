import { expect } from 'bun:test';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import {
  changeDesiredPopulation,
  desiredPopulation,
  desiredPopulationShown,
  givenDesiredPopulation,
  grantPopulationAccess,
  openObservatory,
  populationDenied,
  syntheticActivityShown,
} from '@libs/population-harness/observatory-actions';
import {
  cedarAvailable,
  cedarGameResult,
  cedarSessionEnded,
  completePausedGame,
  finishPausedSession,
  pauseSyntheticUser,
} from '@libs/population-harness/population-control-actions';
import { givenSyntheticUser } from '@libs/population-harness/synthetic-user-fixtures';

Given(
  '{actor} is authorized to view the Bot Observatory',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantPopulationAccess, actor, [PERMISSION.populationView]);
  }
);
Given(
  '{actor} is authorized to configure the Synthetic Population',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantPopulationAccess, actor, [
      PERMISSION.populationView,
      PERMISSION.populationConfigure,
    ]);
  }
);
Given(
  '{actor} is not authorized to view the Bot Observatory',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
  }
);
Given('the desired population is {int}', async (w, desired: number) => {
  await w.s.apply(givenDesiredPopulation, desired);
});
When('{actor} opens the Bot Observatory', async (w, actor: Actor) => {
  await w.s.apply(openObservatory, actor);
});
When(
  '{actor} changes the desired population to {int}',
  async (w, actor: Actor, desired: number) => {
    await w.s.apply(changeDesiredPopulation, actor, desired);
  }
);
Then(
  '{actor} sees a desired population of {int}',
  async (w, actor: Actor, desired: number) => {
    await w.s.until((s) => desiredPopulationShown(s, actor), {
      pred: (value) => value === desired,
      maxMs: 10_000,
    });
  }
);
Then('{actor} is told that permission is required', async (w, actor: Actor) => {
  await w.s.until((s) => populationDenied(s, actor), {
    pred: Boolean,
    maxMs: 10_000,
  });
});
Then('{actor} sees no Synthetic User activity', async (w, actor: Actor) => {
  expect(await w.s.read(syntheticActivityShown, actor)).toBe(false);
});
Then('the desired population remains {int}', async (w, desired: number) => {
  expect(await w.s.read(desiredPopulation)).toBe(desired);
});

Given(
  '{actor} is authorized to control the Synthetic Population',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(grantPopulationAccess, actor, [
      PERMISSION.populationView,
      PERMISSION.populationInspect,
      PERMISSION.populationControl,
    ]);
  }
);
Given(
  'the Synthetic User {string} has an ongoing game',
  async (w, name: string) => {
    await w.s.apply(givenSyntheticUser, name, true);
  }
);
Given('the Synthetic User {string} is available', async (w, name: string) => {
  await w.s.apply(givenSyntheticUser, name, false);
});
When(
  '{actor} pauses the Synthetic User {string}',
  async (w, actor: Actor, name: string) => {
    await w.s.apply(pauseSyntheticUser, actor, name);
  }
);
Then('{string} can finish its ongoing game', async (w, name: string) => {
  expect(name).toBe('Cedar');
  await w.s.apply(completePausedGame);
  await w.s.until(cedarGameResult, {
    pred: (text) => /won the multiplayer game.*checkmate/i.test(text ?? ''),
    maxMs: 10_000,
  });
});
Then('{string} starts no new activity', async (w, name: string) => {
  expect(name).toBe('Cedar');
  await w.s.apply(finishPausedSession);
  await w.s.until(cedarSessionEnded, { pred: Boolean, maxMs: 10_000 });
});
Then('{string} remains available', async (w, name: string) => {
  expect(name).toBe('Cedar');
  expect(await w.s.read(cedarAvailable, 'alice')).toBe(true);
});
