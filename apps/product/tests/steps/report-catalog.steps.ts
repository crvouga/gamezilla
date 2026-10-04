import { expect } from 'bun:test';
import {
  catalogEdition,
  catalogRunning,
  catalogShown,
  completedReportOpen,
  filterCatalog,
  openCatalog,
  openCompletedReport,
  provideCatalog,
} from '@apps/product/developer-catalog';
import { Given, Then, When } from '@libs/harness/define';

Given(
  'two versions of the app have different completed test runs',
  async (w) => {
    await w.s.apply(provideCatalog, 'editions');
  }
);
Given(
  'a version of the app has one completed test run and another still running',
  async (w) => {
    await w.s.apply(provideCatalog, 'running');
  }
);
Given(
  'the team has already seen a completed test run while others are running',
  async (w) => {
    await w.s.apply(provideCatalog, 'running');
    await w.s.apply(openCatalog);
  }
);
Given(
  'the test reports include test run {string}',
  async (w, _name: string) => {
    await w.s.apply(provideCatalog, 'named');
    await w.s.apply(openCatalog);
  }
);
Given(
  'no test run has a name containing {string}',
  async (w, _name: string) => {
    await w.s.apply(provideCatalog, 'named');
    await w.s.apply(openCatalog);
  }
);
Given(
  'the test reports include a failed test run and a passing test run',
  async (w) => {
    await w.s.apply(provideCatalog, 'failures');
    await w.s.apply(openCatalog);
  }
);
When(
  'the team opens the test reports for the earlier version of the app',
  async (w) => {
    await w.s.apply(openCatalog);
  }
);
When("the team opens that version's test reports", async (w) => {
  await w.s.apply(openCatalog);
});
When("the team reopens that version's test reports", async (w) => {
  await w.s.apply(openCatalog);
});
When(
  'the team finds test reports matching {string}',
  async (w, text: string) => {
    await w.s.apply(filterCatalog, text);
  }
);
When('the team shows failed test runs only', async (w) => {
  await w.s.apply(filterCatalog, '', true);
});
Then("the team sees the earlier version's test runs", async (w) => {
  expect((await w.s.read(catalogShown)).map((test) => test.title)).toEqual([
    'Alice accepts a friend request',
  ]);
  expect(await w.s.read(catalogEdition)).toBe(
    '1111111111111111111111111111111111111111'
  );
});
Then(
  "the later version's test runs cannot appear as evidence for the earlier version",
  async (w) => {
    expect(
      (await w.s.read(catalogShown)).some(
        (test) => test.title === 'Later edition only'
      )
    ).toBe(false);
  }
);
Then("the team can open the completed test run's test report", async (w) => {
  await w.s.apply(openCompletedReport);
  expect(await w.s.read(completedReportOpen)).toBe(true);
});
Then('the team sees that the other test run is still running', async (w) => {
  expect(await w.s.read(catalogRunning)).toBe(true);
});
Then('the completed test run appears exactly once', async (w) => {
  expect(
    (await w.s.read(catalogShown)).filter(
      (test) => test.title === 'Alice accepts a friend request'
    )
  ).toHaveLength(1);
});
Then('the team sees test run {string}', async (w, title: string) => {
  expect((await w.s.read(catalogShown)).map((test) => test.title)).toContain(
    title
  );
});
Then('the team is told no test runs match the supplied text', async (w) => {
  expect(await w.s.read(catalogShown)).toHaveLength(0);
});
Then('the team sees the failed test run', async (w) => {
  expect((await w.s.read(catalogShown)).map((test) => test.status)).toEqual([
    'failed',
  ]);
});
Then('the passing test run cannot appear because it passed', async (w) => {
  expect(
    (await w.s.read(catalogShown)).some((test) => test.status === 'passed')
  ).toBe(false);
});
