import { expect } from 'bun:test';
import {
  currentReleaseEvidence,
  provideReleaseEvidence,
  releaseResult,
  runReleaseCheck,
} from '@apps/product/developer-release';
import { Given, Then, When } from '@libs/harness/define';

Given(
  'every required obligation has a current automated pass for this version of the app',
  async (w) => {
    await w.s.apply(provideReleaseEvidence, 'passing');
  }
);
Given(
  'a required obligation has failed for this version of the app',
  async (w) => {
    await w.s.apply(provideReleaseEvidence, 'failed');
  }
);
Given(
  "a required obligation's evidence for this version of the app is {word}",
  async (w, evidence: string) => {
    await w.s.apply(provideReleaseEvidence, evidence);
  }
);
Given(
  "a required obligation's evidence for this version of the app is not run",
  async (w) => {
    await w.s.apply(provideReleaseEvidence, 'not run');
  }
);
Given(
  'an earlier version of the app has a passing release check',
  async (w) => {
    await w.s.apply(provideReleaseEvidence, 'earlier');
  }
);
Given('the current version of the app has no automated evidence', async (w) => {
  expect(await w.s.read(currentReleaseEvidence)).toHaveLength(0);
});
When(
  'the team runs the release check for this version of the app',
  async (w) => {
    await w.s.apply(runReleaseCheck);
  }
);
When(
  'the team runs the release check for the current version of the app',
  async (w) => {
    await w.s.apply(runReleaseCheck);
  }
);
Then('the release check passes for this version of the app', async (w) => {
  expect((await w.s.read(releaseResult))?.status).toBe('pass');
});
Then(
  'the release check fails because a required obligation failed',
  async (w) => {
    expect((await w.s.read(releaseResult))?.problems).toContain('failed');
  }
);
Then(
  'the release check fails because the obligation lacks a current automated pass',
  async (w) => {
    expect((await w.s.read(releaseResult))?.status).toBe('fail');
  }
);
Then(
  'the release check identifies the version of the app it approved',
  async (w) => {
    expect((await w.s.read(releaseResult))?.edition).toBe('current');
  }
);
Then(
  'the release check fails because the evidence belongs to an earlier version',
  async (w) => {
    expect((await w.s.read(releaseResult))?.problems).toContain(
      'earlier-edition'
    );
  }
);
