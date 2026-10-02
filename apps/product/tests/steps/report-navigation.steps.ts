import { expect } from 'bun:test';
import {
  moveRecordedMoment,
  provideRecordedReport,
  selectRecordedMoment,
  shownMoment,
} from '@apps/product/harness/developer-report';
import { Given, Then, When } from '@libs/harness/spec/define';

Given('the team is viewing the first of three recorded moments', async (w) => {
  await w.s.apply(provideRecordedReport, 'passed', 1);
});
Given('the team is viewing the final recorded moment', async (w) => {
  await w.s.apply(provideRecordedReport, 'passed', 3);
});
Given('the team is viewing the second of three recorded moments', async (w) => {
  await w.s.apply(provideRecordedReport, 'passed', 2);
});
Given('the team is viewing the first recorded moment', async (w) => {
  await w.s.apply(provideRecordedReport, 'passed', 1);
});
Given(
  'the team is viewing the final of two failed recorded moments',
  async (w) => {
    await w.s.apply(provideRecordedReport, 'failed', 3);
  }
);
Given(
  "the team is viewing a passing test report's final recorded moment",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'passed', 3);
  }
);
Given('a test report has three recorded moments', async (w) => {
  await w.s.apply(provideRecordedReport, 'failed');
});
Given('a passing test report has three recorded moments', async (w) => {
  await w.s.apply(provideRecordedReport, 'passed');
});
When('the team moves to the next recorded moment', async (w) => {
  await w.s.apply(moveRecordedMoment, 'ArrowRight');
});
When('the team moves to the previous recorded moment', async (w) => {
  await w.s.apply(moveRecordedMoment, 'ArrowLeft');
});
When('the team moves to the next failed recorded moment', async (w) => {
  await w.s.apply(moveRecordedMoment, 'n');
});
When(
  "the team opens that test report's address for its second recorded moment",
  async (w) => {
    await w.s.apply(selectRecordedMoment, 2);
  }
);
When(
  "the team opens that test report's address for its fourth recorded moment",
  async (w) => {
    await w.s.apply(selectRecordedMoment, 4);
  }
);
Then('the team sees the second recorded moment', async (w) => {
  expect(await w.s.read(shownMoment)).toBe(1);
});
Then('the team sees the first recorded moment', async (w) => {
  expect(await w.s.read(shownMoment)).toBe(0);
});
Then('the team sees the first failed recorded moment', async (w) => {
  expect(await w.s.read(shownMoment)).toBe(1);
});
Then(
  'the team still sees the final recorded moment because there is no later moment',
  async (w) => {
    expect(await w.s.read(shownMoment)).toBe(2);
  }
);
Then(
  'the team still sees the first recorded moment because there is no earlier moment',
  async (w) => {
    expect(await w.s.read(shownMoment)).toBe(0);
  }
);
Then(
  'the team still sees the final recorded moment because no recorded moment failed',
  async (w) => {
    expect(await w.s.read(shownMoment)).toBe(2);
  }
);
Then(
  'the team still sees the final recorded moment because the fourth does not exist',
  async (w) => {
    expect(await w.s.read(shownMoment)).toBe(2);
  }
);
