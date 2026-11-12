import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  addPicture,
  deviceTakesNoScreenshot,
  haveScreenshots,
  readNotice,
  readScreenshotShowsBugReport,
  readScreenshots,
  readTeamBugReport,
  removeScreenshot,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given("Alice's device cannot take a screenshot", (w) =>
  w.apply(deviceTakesNoScreenshot)
);
Given('Alice has removed the screenshot', (w) => w.apply(removeScreenshot));
Given('Alice has a bug report with {int} screenshots', (w, count: number) =>
  w.apply(haveScreenshots, count)
);
When('Alice adds a picture', (w) =>
  w.apply(addPicture, { contentType: 'image/png' })
);
When('Alice adds a picture of {int} MB', (w, megabytes: number) =>
  w.apply(addPicture, { contentType: 'image/png', megabytes })
);
When('Alice adds something that is not a picture', (w) =>
  w.apply(addPicture, { contentType: 'application/pdf' })
);
Then("Alice's bug report has {int} screenshot(s)", async (w, count: number) =>
  expect(await w.read(readScreenshots)).toBe(count)
);
Then(
  'the screenshot shows the app as it was before the bug report opened',
  async (w) => expect(await w.read(readScreenshotShowsBugReport)).toBe(false)
);
Then(
  "the team's bug report from Alice has {int} screenshot(s)",
  async (w, count: number) =>
    expect((await w.read(readTeamBugReport))?.screenshots).toBe(count)
);
Then('Alice is told a bug report carries at most 4 screenshots', async (w) =>
  expect(await w.read(readNotice)).toBe('too-many')
);
Then('Alice is told a picture can be up to 5 MB', async (w) =>
  expect(await w.read(readNotice)).toBe('too-large')
);
Then('Alice is told only pictures can be added', async (w) =>
  expect(await w.read(readNotice)).toBe('not-a-picture')
);
