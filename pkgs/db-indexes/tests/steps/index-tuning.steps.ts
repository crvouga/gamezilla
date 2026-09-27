/**
 * Steps for index tuning (`specs/index-tuning/index-tuning.feature`), over
 * the tuning sim's actions and reads.
 */

import { expect } from 'bun:test';
import {
  daysPass,
  declare,
  keepOwnIndex,
  lastTuningChanges,
  retiringLookups,
  TUNING_CONFIG,
  teamIndexKept,
  tune,
  tunedLookups,
  use,
} from '@pkgs/db-indexes/sim';
import { Given, Then, type TuningWorld, When } from './world';

const RETIREMENT_WINDOW_DAYS = TUNING_CONFIG.deprecationWindowDays ?? 0;

async function authorLookupTuned(w: TuningWorld): Promise<void> {
  await w.sim.apply(declare, ['notesByAuthor']);
  await w.sim.apply(tune);
  if (!(await w.sim.read(tunedLookups)).includes('notesByAuthor')) {
    throw new Error('setup: notes-by-author got no tuned index');
  }
}

async function authorIndexRetiring(w: TuningWorld): Promise<void> {
  await authorLookupTuned(w);
  await w.sim.apply(declare, []);
  await w.sim.apply(tune);
  if (!(await w.sim.read(retiringLookups)).includes('notesByAuthor')) {
    throw new Error('setup: the notes-by-author index is not retiring');
  }
}

Given('the team declares the notes-by-author lookup', async (w) => {
  await w.sim.apply(declare, ['notesByAuthor']);
});

Given('the team no longer declares any lookup', async (w) => {
  await w.sim.apply(declare, []);
});

Given(
  'the notes-by-author lookup has been given a tuned index',
  authorLookupTuned
);

Given('the notes-by-author index has started retiring', authorIndexRetiring);

Given(
  'the notes-by-author index has been used since it began retiring',
  async (w) => {
    await w.sim.apply(use, 'notesByAuthor');
  }
);

Given('the team keeps its own index', async (w) => {
  await w.sim.apply(keepOwnIndex);
});

Given('tuning has run', async (w) => {
  await w.sim.apply(tune);
});

Given('the retirement window has passed', async (w) => {
  await w.sim.apply(daysPass, RETIREMENT_WINDOW_DAYS);
});

Given('{int} days have passed', async (w, days: number) => {
  await w.sim.apply(daysPass, days);
});

When('tuning runs', async (w) => {
  await w.sim.apply(tune);
});

Then('the notes-by-author lookup has a tuned index', async (w) => {
  expect(await w.sim.read(tunedLookups)).toContain('notesByAuthor');
});

Then('tuning changes nothing', async (w) => {
  expect(await w.sim.read(lastTuningChanges)).toBe(0);
});

Then('the notes-by-author index is retiring', async (w) => {
  expect(await w.sim.read(retiringLookups)).toContain('notesByAuthor');
});

Then('the notes-by-author index is not retiring', async (w) => {
  expect(await w.sim.read(retiringLookups)).not.toContain('notesByAuthor');
});

Then('the notes-by-author index is still there', async (w) => {
  expect(await w.sim.read(tunedLookups)).toContain('notesByAuthor');
});

Then('the notes-by-author index is gone', async (w) => {
  expect(await w.sim.read(tunedLookups)).not.toContain('notesByAuthor');
});

Then("the team's own index is still there", async (w) => {
  expect(await w.sim.read(teamIndexKept)).toBe(true);
});
