import { expect } from 'bun:test';
import {
  openPerformanceHeatmap,
  performanceView,
  provideMeasuredReport,
  selectPerformanceStep,
} from '@apps/product/developer-performance';
import { Given, Then, When } from '@libs/harness/define';

Given(
  'a test report records a step that took longer than the chosen allowance',
  async (w) => {
    await w.s.apply(provideMeasuredReport, 'slow');
  }
);
Given('a test report records a step within the chosen allowance', async (w) => {
  await w.s.apply(provideMeasuredReport, 'quick');
});
Given('a test report has no recorded time for its steps', async (w) => {
  await w.s.apply(provideMeasuredReport, 'unmeasured');
});
Given('a test report records a slow step with a recorded moment', async (w) => {
  await w.s.apply(provideMeasuredReport, 'slow');
  await w.s.apply(openPerformanceHeatmap);
});
When("the team opens that test report's heatmap", async (w) => {
  await w.s.apply(openPerformanceHeatmap);
});
When('the team selects that step in the heatmap', async (w) => {
  await w.s.apply(selectPerformanceStep);
});
Then('the team sees the recorded time for that step', async (w) => {
  expect((await w.s.read(performanceView)).text).toContain('80.00 ms');
});
Then('that step is marked as slow', async (w) => {
  expect((await w.s.read(performanceView)).slow).toBe(true);
});
Then(
  'that step is not marked as slow because it stayed within the allowance',
  async (w) => {
    expect((await w.s.read(performanceView)).slow).toBe(false);
  }
);
Then('the team is told measurements are unavailable', async (w) => {
  expect((await w.s.read(performanceView)).unavailable).toBe(true);
});
Then('the team sees the heatmap for its recorded steps', async (w) => {
  expect((await w.s.read(performanceView)).heatmap).toBe(true);
});
Then("the team sees that step's recorded moment", async (w) => {
  expect((await w.s.read(performanceView)).moment).toBe(0);
});
