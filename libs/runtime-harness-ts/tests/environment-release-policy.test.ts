import { expect, test } from 'bun:test';
import { preparationOutcome } from '@libs/runtime-server-ts/environment-release';
import { readReleasePolicy } from './environment-release-policy';

// regression: workspace-preparation-warning-policy
test('the system setup warning still tells the team and permits opening', async () => {
  expect(preparationOutcome(await readReleasePolicy())).toBe('told-and-open');
});
