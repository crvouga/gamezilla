import { expect } from 'bun:test';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  allowShakeToReport,
  applicationCondition,
  chooseToReport,
  closeBugReport,
  phoneAsksBeforeShaking,
  readOpenBugReports,
  readToldToReportWithoutShaking,
  refuseShakeToReport,
  shakePhone,
  turnOffShakeToReport,
} from '@pkgs/feedback-harness-ts/feedback';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();

Given("Alice's app is working", (w) =>
  w.apply(applicationCondition, 'working')
);
Given("Alice's app has crashed", (w) =>
  w.apply(applicationCondition, 'crashed')
);
Given("Alice's app stays loading", (w) =>
  w.apply(applicationCondition, 'loading')
);
Given("Alice's app cannot sign in", (w) =>
  w.apply(applicationCondition, 'cannot-sign-in')
);
Given('Alice has opened a bug report', (w) => w.apply(chooseToReport));
Given('Alice has closed the bug report', (w) => w.apply(closeBugReport));
Given('Alice has turned off shake to report', (w) =>
  w.apply(turnOffShakeToReport)
);
Given("Alice's phone asks before the app may notice shaking", (w) =>
  w.apply(phoneAsksBeforeShaking)
);
Given('Alice has allowed shake to report', (w) => w.apply(allowShakeToReport));
Given('Alice has turned shake to report back on', (w) =>
  w.apply(allowShakeToReport)
);
When('Alice chooses to report a bug', (w) => w.apply(chooseToReport));
When('Alice closes the bug report', (w) => w.apply(closeBugReport));
When('Alice shakes the phone', (w) => w.apply(shakePhone));
When('Alice refuses to allow shake to report', (w) =>
  w.apply(refuseShakeToReport)
);
Then('Alice has one bug report open', async (w) =>
  expect(await w.read(readOpenBugReports)).toBe(1)
);
Then('Alice (still )has no bug report open', async (w) =>
  expect(await w.read(readOpenBugReports)).toBe(0)
);
Then('Alice is told to choose to report a bug instead of shaking', async (w) =>
  expect(await w.read(readToldToReportWithoutShaking)).toBe(true)
);
