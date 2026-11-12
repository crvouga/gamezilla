import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  becomeGuest,
  describeBug,
  readDescription,
  readNotice,
  readTeamBugReport,
  readTeamBugReportCount,
  reopenApp,
  sendBugReport,
  sendBugReportSaying,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given('Alice is a guest', (w) => w.apply(becomeGuest));
Given('Alice has described the bug as {string}', (w, description: string) =>
  w.apply(describeBug, description)
);
Given('Alice has sent a bug report saying {string}', (w, description: string) =>
  w.apply(sendBugReportSaying, description)
);
When('Alice sends the bug report', (w) => w.apply(sendBugReport));
Given('Alice has reopened the app', (w) => w.apply(reopenApp));
Then('Alice is told the team has the bug report', async (w) =>
  expect(await w.read(readNotice)).toBe('sent')
);
Then('Alice is told to describe the bug before sending', async (w) =>
  expect(await w.read(readNotice)).toBe('describe')
);
Then(
  'the team has a bug report from Alice saying {string}',
  async (w, description: string) =>
    expect((await w.read(readTeamBugReport))?.description).toBe(description)
);
Then('the team has no bug report from Alice', async (w) =>
  expect(await w.read(readTeamBugReportCount)).toBe(0)
);
Then("Alice's bug report says {string}", async (w, description: string) =>
  expect(await w.read(readDescription)).toBe(description)
);
Then("Alice's bug report has no description", async (w) =>
  expect(await w.read(readDescription)).toBe('')
);
