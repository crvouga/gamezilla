import { expect } from 'bun:test';
import {
  exploreParts,
  explorerHasReport,
  explorerOffersRetry,
  explorerText,
  exploreSpecs,
  openExplorerReports,
  provideExplorer,
  retryExplorerReports,
} from '@apps/product/developer-explorer';
import { Given, Then, When } from '@libs/harness/define';

Given(
  'a version of the app has specs with completed test reports',
  async (w) => {
    await w.s.apply(provideExplorer, 'completed');
  }
);
Given(
  'a version of the app has a spec without a completed test report',
  async (w) => {
    await w.s.apply(provideExplorer, 'missing');
  }
);
Given(
  'a version of the app has completed test reports and a newly completed UI quality check',
  async (w) => {
    await w.s.apply(provideExplorer, 'quality');
  }
);
Given(
  'a performance check belongs only to a later version of the app',
  async (w) => {
    await w.s.apply(provideExplorer, 'foreign');
  }
);
Given('a version of the app has a completed performance check', async (w) => {
  await w.s.apply(provideExplorer, 'performance');
});
Given('a version of the app has no completed UI quality check', async (w) => {
  await w.s.apply(provideExplorer, 'no-quality');
});
Given("the team's test reports are unavailable", async (w) => {
  await w.s.apply(provideExplorer, 'unavailable');
});
Given(
  "the team's unavailable test reports have become available",
  async (w) => {
    await w.s.apply(provideExplorer, 'recovered');
  }
);
When("the team explores that version's specs", async (w) => {
  await w.s.apply(exploreSpecs);
});
When("the team explores that version's report parts", async (w) => {
  await w.s.apply(exploreParts);
});
When("the team explores the earlier version's report parts", async (w) => {
  await w.s.apply(exploreParts);
});
When('the team investigates which test reports are available', async (w) => {
  await w.s.apply(openExplorerReports);
});
When('the team asks to open the test reports again', async (w) => {
  await w.s.apply(retryExplorerReports);
});
Then('the team can read each spec and open its test reports', async (w) => {
  expect(await w.s.read(explorerText)).toContain(
    'Then Alice and Bob are friends'
  );
  expect(await w.s.read(explorerHasReport)).toBe(true);
});
Then('the team can read that spec', async (w) => {
  expect(await w.s.read(explorerText)).toContain(
    'Then Alice and Bob are friends'
  );
});
Then('the team is told it has no completed test report', async (w) => {
  expect(await w.s.read(explorerText)).toContain(
    'No completed test report is recorded for this spec'
  );
});
Then(
  'the team sees both the test reports and the UI quality check',
  async (w) => {
    expect(await w.s.read(explorerText)).toContain('Test reports1');
    expect(await w.s.read(explorerText)).toContain(
      'Friend request presentation'
    );
  }
);
Then(
  'the team is told the earlier version has no completed performance check',
  async (w) => {
    expect(await w.s.read(explorerText)).toContain(
      'No completed performance check is recorded for this version'
    );
  }
);
Then("the team sees the performance check's measured outcome", async (w) => {
  expect(await w.s.read(explorerText)).toContain('12.00 ms / 50 ms');
});
Then(
  'the team is told the UI quality check has not been completed',
  async (w) => {
    expect(await w.s.read(explorerText)).toContain(
      'The UI quality check has not been completed for this version'
    );
  }
);
Then('the team is told why the test reports are unavailable', async (w) => {
  expect(await w.s.read(explorerText)).toContain('no reports read credential');
});
Then('the team is offered another attempt', async (w) => {
  expect(await w.s.read(explorerOffersRetry)).toBe(true);
});
Then('the team sees the available test reports', async (w) => {
  expect(await w.s.read(explorerText)).toContain('investigation');
  expect(await w.s.read(explorerOffersRetry)).toBe(false);
});
