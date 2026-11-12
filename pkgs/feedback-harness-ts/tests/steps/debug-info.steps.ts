import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  chooseToReport,
  comeBackToDraft,
  openSettings,
  readTeamBugReport,
  readToldAboutDebugInfo,
  runIntoTrouble,
  typeInApp,
  waitMinutes,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given('Alice has opened Settings', (w) => w.apply(openSettings));
Given('Alice opened Settings {int} minutes ago', async (w, minutes: number) => {
  await w.apply(openSettings);
  await w.apply(waitMinutes, minutes);
});
Given(
  'Alice opened Settings {int} minutes before opening a bug report',
  async (w, minutes: number) => {
    await w.apply(openSettings);
    await w.apply(waitMinutes, minutes);
    await w.apply(chooseToReport);
  }
);
Given(
  'Alice opened Settings {int} minutes later',
  async (w, minutes: number) => {
    await w.apply(waitMinutes, minutes);
    await w.apply(openSettings);
  }
);
Given(
  'Alice has come back to the draft after {int} minutes',
  (w, minutes: number) => w.apply(comeBackToDraft, minutes)
);
Given("Alice's app has run into trouble", (w) => w.apply(runIntoTrouble));
Given('Alice has typed {string} in the app', (w, text: string) =>
  w.apply(typeInApp, text)
);
Then(
  "the team's bug report from Alice shows that Alice opened Settings",
  async (w) =>
    expect((await w.read(readTeamBugReport))?.ledUpTo).toContain('Settings')
);
Then(
  "the team's bug report from Alice does not show that Alice opened Settings",
  async (w) =>
    expect((await w.read(readTeamBugReport))?.ledUpTo).not.toContain('Settings')
);
Then(
  "the team's bug report from Alice shows the trouble the app ran into",
  async (w) =>
    expect((await w.read(readTeamBugReport))?.showsTrouble).toBe(true)
);
Then(
  "the team's bug report from Alice names Alice's device and the version of the app",
  async (w) =>
    expect(await w.read(readTeamBugReport)).toMatchObject({
      namesDevice: true,
      namesVersion: true,
    })
);
Then(
  "the team's bug report from Alice does not contain {string}",
  async (w, text: string) =>
    expect((await w.read(readTeamBugReport))?.everything).not.toContain(text)
);
Then(
  'Alice is told the bug report includes debug info and never what Alice typed',
  async (w) => expect(await w.read(readToldAboutDebugInfo)).toBe(true)
);
