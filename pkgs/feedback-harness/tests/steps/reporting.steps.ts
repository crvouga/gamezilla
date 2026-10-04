import { expect } from 'bun:test';
import { applicationCondition, closeApplication, diagnosticsCondition, readEmergencyReport, readReport, submitReport } from '@pkgs/feedback-harness/feedback';
import type { FeedbackReportingWorld } from '@pkgs/feedback-harness/feedback';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-shared/run-types';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();
Given("the team's app is working", (w) =>
  w.apply(applicationCondition, 'working')
);
Given("the team's app stays loading", (w) =>
  w.apply(applicationCondition, 'loading')
);
Given("the team's app has crashed", (w) =>
  w.apply(applicationCondition, 'crashed')
);
Given("the team's app cannot open Settings", (w) =>
  w.apply(applicationCondition, 'router')
);
Given("the team's app cannot sign in", (w) =>
  w.apply(applicationCondition, 'auth')
);
Given("the team's device is offline", (w) =>
  w.apply(applicationCondition, 'offline')
);
Given('some diagnostics are unavailable', (w) =>
  w.apply(diagnosticsCondition, 'throws')
);
Given('some diagnostics never arrive', (w) =>
  w.apply(diagnosticsCondition, 'hangs')
);
Given('the team has kept local feedback titled {string}', (w, title: string) =>
  w.apply(submitReport, {
    title,
    body: 'The board stopped after my move',
  })
);
When(
  'the team submits feedback titled {string} saying {string}',
  (w, title: string, body: string) => w.apply(submitReport, { title, body })
);
When("the team's app closes", (w) => w.apply(closeApplication));
Then('the team can read the local feedback', async (w) => {
  expect(await w.read(readReport)).not.toBeNull();
});
Then('the feedback contains the available diagnostics', async (w) => {
  const report = await w.read(readReport);
  expect(report?.diagnostics).toContainEqual({
    name: 'context',
    status: 'available',
    value: { captured: true },
  });
});
Then('the feedback identifies unavailable diagnostics', async (w) => {
  const report = await w.read(readReport);
  expect(report?.diagnostics).toContainEqual({
    name: 'context',
    status: 'unavailable',
    reason: 'Unavailable',
  });
});

Given('the team cannot send feedback', (w) =>
  w.apply(applicationCondition, 'delivery-fails')
);
Then('the team can copy the feedback to keep for later', async (w) => {
  const report = await w.read(readEmergencyReport);
  expect(report).toBeTruthy();
  expect(report).toContain('body');
});
Then('the feedback has not been saved locally', async (w) => {
  expect(await w.read(readReport)).toBeNull();
});
