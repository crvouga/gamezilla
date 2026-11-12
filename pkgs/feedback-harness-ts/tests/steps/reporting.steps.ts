import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  addToDescription,
  becomeGuest,
  describeBug,
  describeBugAtLength,
  discardDraft,
  readDescription,
  readDescriptionFull,
  readDraft,
  readNotice,
  readTeamBugReport,
  readTeamBugReportCount,
  reopenApp,
  sendBugReport,
  sendBugReportSaying,
  signIn,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given('Alice is a guest', (w) => w.apply(becomeGuest));
Given('Alice is signed in', (w) => w.apply(signIn));
Given('Alice has described the bug in {int} characters', (w, count: number) =>
  w.apply(describeBugAtLength, count)
);
Given('Alice has discarded the draft', (w) => w.apply(discardDraft));
When('Alice describes the bug in {int} characters', (w, count: number) =>
  w.apply(describeBugAtLength, count)
);
When('Alice adds to the description', (w) => w.apply(addToDescription));
When('Alice discards the draft', (w) => w.apply(discardDraft));
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
Then("Alice's description has {int} characters", async (w, count: number) =>
  expect((await w.read(readDescription)).length).toBe(count)
);
Then('Alice is not told the description is full', async (w) =>
  expect(await w.read(readDescriptionFull)).toBe(false)
);
Then('Alice is told the description is full at 4,000 characters', async (w) =>
  expect(await w.read(readDescriptionFull)).toBe(true)
);
Then("the team's bug report from Alice names Alice's account", async (w) =>
  expect((await w.read(readTeamBugReport))?.namesAccount).toBe(true)
);
Then("the team's bug report from Alice says it came from a guest", async (w) =>
  expect((await w.read(readTeamBugReport))?.fromGuest).toBe(true)
);
Then('Alice has no draft', async (w) =>
  expect(await w.read(readDraft)).toBeNull()
);
