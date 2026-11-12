import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  connection,
  describeBug,
  passDay,
  readNotice,
  readTeamBugReportsSaying,
  reopenApp,
  sendBugReport,
  sendBugReportSaying,
  sendBugReports,
  teamReceivesAgain,
  teamStopsReceiving,
  useAnotherDevice,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given("Alice's device is offline", (w) => w.apply(connection, false));
Given(
  'Alice has sent a bug report saying {string} while offline',
  async (w, description: string) => {
    await w.apply(connection, false);
    await w.apply(sendBugReportSaying, description);
  }
);
Given('the team cannot receive bug reports', (w) =>
  w.apply(teamStopsReceiving)
);
Given(
  'Alice has sent a bug report saying {string} while the team could not receive bug reports',
  async (w, description: string) => {
    await w.apply(teamStopsReceiving);
    await w.apply(sendBugReportSaying, description);
  }
);
Given('Alice has sent {int} bug reports today', (w, count: number) =>
  w.apply(sendBugReports, count)
);
Given('Alice sent 10 bug reports yesterday', async (w) => {
  await w.apply(sendBugReports, 10);
  await w.apply(passDay);
});
Given(
  'Alice has sent a bug report saying {string} past the daily bug report limit',
  async (w, description: string) => {
    await w.apply(sendBugReports, 10);
    await w.apply(sendBugReportSaying, description);
  }
);
Given(
  'Alice has described the bug as {string} on another device',
  async (w, description: string) => {
    await w.apply(useAnotherDevice);
    await w.apply(describeBug, description);
  }
);
Given("Alice's device has gone offline and come back online", async (w) => {
  await w.apply(connection, false);
  await w.apply(connection, true);
});
When('the next day starts', (w) => w.apply(passDay));
When('Alice sends the bug report from the other device', (w) =>
  w.apply(sendBugReport)
);
When('Alice reopens the app', (w) => w.apply(reopenApp));
When("Alice's device is back online", (w) => w.apply(connection, true));
When('the team can receive bug reports again', (w) =>
  w.apply(teamReceivesAgain)
);
Then(
  'Alice is told the bug report will be sent when Alice is back online',
  async (w) => expect(await w.read(readNotice)).toBe('offline')
);
Then('Alice is told the bug report is kept and will be sent later', async (w) =>
  expect(await w.read(readNotice)).toBe('later')
);
Then(
  'Alice is told the daily bug report limit is reached until tomorrow',
  async (w) => expect(await w.read(readNotice)).toBe('limit')
);
Then(
  'the team has no bug report from Alice saying {string}',
  async (w, description: string) =>
    expect(await w.read(readTeamBugReportsSaying, description)).toBe(0)
);
Then(
  'the team has exactly one bug report from Alice saying {string}',
  async (w, description: string) =>
    expect(await w.read(readTeamBugReportsSaying, description)).toBe(1)
);
