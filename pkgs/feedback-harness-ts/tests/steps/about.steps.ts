import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  readScreenshotMarks,
  readTeamBugReport,
  reportBugAbout,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given('Alice has reported a bug about {string}', (w, name: string) =>
  w.apply(reportBugAbout, name)
);
When('Alice reports a bug about {string}', (w, name: string) =>
  w.apply(reportBugAbout, name)
);
Then(
  "the team's bug report from Alice is about {string}",
  async (w, name: string) =>
    expect((await w.read(readTeamBugReport))?.about).toBe(name)
);
Then(
  "the team's bug report from Alice is about nothing in particular",
  async (w) => expect((await w.read(readTeamBugReport))?.about).toBeNull()
);
Then('the screenshot marks {string}', async (w, name: string) =>
  expect(await w.read(readScreenshotMarks)).toBe(name)
);
Then('the screenshot marks nothing', async (w) =>
  expect(await w.read(readScreenshotMarks)).toBeNull()
);
