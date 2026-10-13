import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import {
  environmentView,
  keepReleaseCheck,
  keepUnfinishedRelease,
  noteReleaseFact,
  prepareDespiteFailure,
  releaseAfterFailure,
  releaseAfterPass,
  releaseFact,
  replaceRunningCheck,
  stopStartedRelease,
} from '@libs/runtime-harness/environment-release-actions';
import { readReleasePolicy } from '../environment-release-policy';

Given('preparation of the environment cannot finish', () => undefined);
When('the team prepares that environment', async (w) => {
  await w.s.apply(prepareDespiteFailure, await readReleasePolicy());
});
Then('the team is told preparation could not finish', async (w) => {
  expect((await w.s.read(environmentView)).openState).toBe('told-and-open');
});
Then('the team can still open the environment', async (w) => {
  expect((await w.s.read(environmentView)).openState).toBe('told-and-open');
});

Given('the release check passed for this version of the app', async (w) => {
  await w.s.apply(noteReleaseFact, 'passed');
});
Given('the release check failed for this version of the app', async (w) => {
  await w.s.apply(noteReleaseFact, 'failed');
});
When('the team puts out this version of the app', async (w) => {
  const policy = await readReleasePolicy();
  const fact = await w.s.read(releaseFact);
  await w.s.apply(
    fact === 'failed' ? releaseAfterFailure : releaseAfterPass,
    policy
  );
});
Then('the release is finished', async (w) => {
  expect((await w.s.read(environmentView)).releaseState).toBe('finished');
});
Then(
  'the release is not finished because the release check failed',
  async (w) => {
    expect((await w.s.read(environmentView)).releaseState).toBe('refused');
  }
);

Given('a release check of a change is still running', () => undefined);
When('the team starts a newer release check of that same change', async (w) => {
  await w.s.apply(replaceRunningCheck, await readReleasePolicy());
});
Then('the earlier release check is no longer running', async (w) => {
  expect((await w.s.read(environmentView)).checkState).toBe('replaced');
});

Given('a release check for a release is still running', async (w) => {
  await w.s.apply(noteReleaseFact, 'release-check');
});
Given('a release is unfinished', async (w) => {
  await w.s.apply(noteReleaseFact, 'unfinished');
});
When('the team starts another release', async (w) => {
  const policy = await readReleasePolicy();
  const fact = await w.s.read(releaseFact);
  await w.s.apply(
    fact === 'unfinished' ? keepUnfinishedRelease : keepReleaseCheck,
    policy
  );
});
Then("the earlier release's check is still running", async (w) => {
  expect((await w.s.read(environmentView)).checkState).toBe('kept');
});
Then('the unfinished release is still unfinished', async (w) => {
  expect((await w.s.read(environmentView)).releaseState).toBe('unfinished');
});

Given('a release has started', () => undefined);
When('the team stops that release', async (w) => {
  await w.s.apply(stopStartedRelease, await readReleasePolicy());
});
Then('that unfinished release is not undone', async (w) => {
  expect((await w.s.read(environmentView)).releaseState).toBe('unfinished');
});
