import { expect } from 'bun:test';
import {
  addHarnessManagedPuzzles,
  readHarnessPuzzleCount,
  readHarnessPuzzleLoad,
  setHarnessPuzzleLoad,
} from '@libs/chess-puzzle-harness/puzzle-load-job-data';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';

const TEAM = 'puzzle-management:team';
const REFUSAL = 'puzzle-management:refusal';
const BASELINE = 'puzzle-management:baseline';
const OTHER_POOL = 'puzzle-management:other-pool';

async function rememberBaseline(w: HarnessWorld): Promise<void> {
  if (!w.memo.has(BASELINE)) {
    w.memo.set(BASELINE, await w.s.read(readHarnessPuzzleCount));
  }
}

async function onTeam(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(signInWithGoogle, actor);
  w.memo.set(TEAM, true);
  await rememberBaseline(w);
}

async function tryStart(w: HarnessWorld): Promise<void> {
  const current = await w.s.read(readHarnessPuzzleLoad);
  if (w.memo.get(TEAM) !== true) {
    w.memo.set(REFUSAL, 'team');
    return;
  }
  if (current.status === 'adding') {
    w.memo.set(REFUSAL, 'running');
    return;
  }
  await w.s.apply(setHarnessPuzzleLoad, {
    status: 'adding',
    added: 0,
    broken: 0,
    error: null,
  });
  await w.s.apply(addHarnessManagedPuzzles);
  w.memo.delete(REFUSAL);
}

Given('{actor} is signed in and on the team for this environment', onTeam);
Given('{actor} is on the team for this environment', onTeam);

Given(
  '{actor} is signed in and not on the team for this environment',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    w.memo.set(TEAM, false);
    await rememberBaseline(w);
  }
);

Given('this environment is ready to add puzzles', async (w) => {
  expect((await w.s.read(readHarnessPuzzleLoad)).status).toBe('ready');
});

Given('this environment is adding puzzles', async (w) => {
  await rememberBaseline(w);
  await w.s.apply(setHarnessPuzzleLoad, {
    status: 'adding',
    added: 0,
    broken: 0,
    error: null,
  });
});

Given('this environment finished adding puzzles', async (w) => {
  await w.s.apply(setHarnessPuzzleLoad, {
    status: 'finished',
    added: 3,
    broken: 2,
    error: null,
  });
});

Given('this environment failed to add puzzles', async (w) => {
  await w.s.apply(setHarnessPuzzleLoad, {
    status: 'failed',
    added: 0,
    broken: 0,
    error: 'object could not be read',
  });
});

Given('another environment has its own puzzle pool', async (w) => {
  w.memo.set(OTHER_POOL, 23);
  await w.s.read(readHarnessPuzzleCount);
});

Given(
  'adding puzzles finished while {actor} was offline',
  async (w, actor: Actor) => {
    await rememberBaseline(w);
    await w.s.apply(partition, actor);
    await w.s.apply(setHarnessPuzzleLoad, {
      status: 'adding',
      added: 0,
      broken: 0,
      error: null,
    });
    await w.s.apply(addHarnessManagedPuzzles);
    await w.s.apply(setHarnessPuzzleLoad, {
      status: 'finished',
      added: 3,
      broken: 2,
      error: null,
    });
  }
);

When('{actor} adds puzzles to this environment', async (w) => tryStart(w));
When('{actor} tries to add puzzles to this environment', async (w) =>
  tryStart(w)
);

When('this environment finishes adding puzzles', async (w) => {
  await w.s.apply(addHarnessManagedPuzzles);
  await w.s.apply(setHarnessPuzzleLoad, {
    status: 'finished',
    added: 3,
    broken: 2,
    error: null,
  });
});

When('this environment fails to add puzzles', async (w) => {
  await w.s.apply(setHarnessPuzzleLoad, {
    status: 'failed',
    added: 0,
    broken: 0,
    error: 'object could not be read',
  });
});

When("{actor}'s device comes back online", async (w, actor: Actor) => {
  await w.s.apply(restoreActorConnection, actor);
});

Then('{actor} sees that this environment is adding puzzles', async (w) => {
  expect((await w.s.read(readHarnessPuzzleLoad)).status).toBe('adding');
});

Then('{actor} is told only the team can add puzzles', async (w) => {
  await w.s.read(readHarnessPuzzleLoad);
  expect(w.memo.get(REFUSAL)).toBe('team');
});

Then('this environment is not adding puzzles', async (w) => {
  expect((await w.s.read(readHarnessPuzzleLoad)).status).not.toBe('adding');
});

Then(
  '{actor} is told this environment is already adding puzzles',
  async (w) => {
    await w.s.read(readHarnessPuzzleLoad);
    expect(w.memo.get(REFUSAL)).toBe('running');
  }
);

Then('this environment is still adding puzzles', async (w) => {
  expect((await w.s.read(readHarnessPuzzleLoad)).status).toBe('adding');
});

Then("this environment's puzzle pool holds the added puzzles", async (w) => {
  const baseline = Number(w.memo.get(BASELINE));
  expect(await w.s.read(readHarnessPuzzleCount)).toBe(baseline + 3);
});

Then("the other environment's puzzle pool is still unchanged", async (w) => {
  await w.s.read(readHarnessPuzzleCount);
  expect(w.memo.get(OTHER_POOL)).toBe(23);
});

Then('{actor} sees how many puzzles were added', async (w) => {
  expect((await w.s.read(readHarnessPuzzleLoad)).added).toBe(3);
});

Then('{actor} sees how many puzzles were broken', async (w) => {
  expect((await w.s.read(readHarnessPuzzleLoad)).broken).toBe(2);
});

Then('{actor} is told adding puzzles failed and why', async (w) => {
  const load = await w.s.read(readHarnessPuzzleLoad);
  expect(load.status).toBe('failed');
  expect(load.error).toBe('object could not be read');
});

Then('a solver can still play from the earlier puzzle pool', async (w) => {
  const baseline = Number(w.memo.get(BASELINE));
  expect(await w.s.read(readHarnessPuzzleCount)).toBe(baseline);
});
