import { expect } from 'bun:test';
import {
  type BugReportingWorld,
  closeProduct,
  diagnosticsCondition,
  productCondition,
  readEmergencyReport,
  readReport,
  submitReport,
} from '@pkgs/bug-report/harness';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given, When, Then } = stepsFor<Run<BugReportingWorld>>();
Given("the team's app is working", (w) => w.apply(productCondition, 'working'));
Given("the team's app stays loading", (w) =>
  w.apply(productCondition, 'loading')
);
Given("the team's app has crashed", (w) =>
  w.apply(productCondition, 'crashed')
);
Given("the team's app cannot open a screen", (w) =>
  w.apply(productCondition, 'router')
);
Given("the team's app cannot sign in", (w) =>
  w.apply(productCondition, 'auth')
);
Given("the team's device is offline", (w) =>
  w.apply(productCondition, 'offline')
);
Given('some diagnostics are unavailable', (w) =>
  w.apply(diagnosticsCondition, 'throws')
);
Given('some diagnostics never arrive', (w) =>
  w.apply(diagnosticsCondition, 'hangs')
);
Given(
  'the team has kept a local bug report titled {string}',
  (w, title: string) =>
    w.apply(submitReport, {
      title,
      description: 'The board stopped after my move',
    })
);
When(
  'the team submits a bug report titled {string} saying {string}',
  (w, title: string, description: string) =>
    w.apply(submitReport, { title, description })
);
When("the team's app closes", (w) => w.apply(closeProduct));
Then('the team can read the local bug report', async (w) => {
  expect(await w.read(readReport)).not.toBeNull();
});
Then('the bug report contains the available diagnostics', async (w) => {
  const report = await w.read(readReport);
  expect(report?.diagnostics).toContainEqual({
    name: 'context',
    status: 'available',
    value: { captured: true },
  });
});
Then('the bug report identifies unavailable diagnostics', async (w) => {
  const report = await w.read(readReport);
  expect(report?.diagnostics).toContainEqual({
    name: 'context',
    status: 'unavailable',
    reason: 'Unavailable',
  });
});

Given('the team cannot send a bug report', (w) =>
  w.apply(productCondition, 'delivery-fails')
);
Then('the team can copy the bug report to keep for later', async (w) => {
  const report = await w.read(readEmergencyReport);
  expect(report?.title).toBe('Board froze');
  expect(report?.description).toBe('Stopped after a move');
});
Then('the bug report has not been saved locally', async (w) => {
  expect(await w.read(readReport)).toBeNull();
});
