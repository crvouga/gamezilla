import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  describeBug,
  listenToApp,
  moveKeyboardThroughBugReport,
  readHeardControls,
  readHeardNotice,
  readHeardScreenshots,
  readKeyboardBeforeOpening,
  readKeyboardInBugReport,
  readKeyboardOnDescription,
  readKeyboardPlace,
  readKeyboardStops,
  readKeyboardVisits,
  useKeyboardAlone,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given('Alice is using the keyboard alone', (w) => w.apply(useKeyboardAlone));
Given('Alice is listening to the app', (w) => w.apply(listenToApp));
When('Alice moves the keyboard through the bug report', (w) =>
  w.apply(moveKeyboardThroughBugReport)
);
When('Alice describes the bug as {string}', (w, description: string) =>
  w.apply(describeBug, description)
);
Then("Alice's keyboard is in the bug report", async (w) =>
  expect(await w.read(readKeyboardInBugReport)).toBe(true)
);
Then(
  "Alice's keyboard reaches every control of the bug report once, in the order they are shown",
  async (w) => {
    const shown = await w.read(readKeyboardStops);
    expect(shown).not.toEqual([]);
    expect(await w.read(readKeyboardVisits)).toEqual(shown);
  }
);
// regression: feedback-typing-steals-focus
Then("Alice's keyboard stays on the description", async (w) =>
  expect(await w.read(readKeyboardOnDescription)).toBe(true)
);
Then(
  "Alice's keyboard is back where it was before Alice opened the bug report",
  async (w) => {
    const before = await w.read(readKeyboardBeforeOpening);
    expect(before).not.toBeNull();
    expect(await w.read(readKeyboardPlace)).toBe(before);
  }
);
Then('Alice hears what every control of the bug report does', async (w) => {
  const heard = await w.read(readHeardControls);
  expect(heard.controls).not.toEqual([]);
  expect(heard.problems).toEqual([]);
});
Then(
  'Alice hears that the bug report has {int} screenshots',
  async (w, count: number) =>
    expect(await w.read(readHeardScreenshots)).toBe(count)
);
Then('Alice hears that the team has the bug report', async (w) =>
  expect(await w.read(readHeardNotice)).toBe('sent')
);
Then(
  'Alice hears that the bug report will be sent when Alice is back online',
  async (w) => expect(await w.read(readHeardNotice)).toBe('offline')
);
Then(
  'Alice hears that the bug report needs a description before it is sent',
  async (w) => expect(await w.read(readHeardNotice)).toBe('describe')
);
