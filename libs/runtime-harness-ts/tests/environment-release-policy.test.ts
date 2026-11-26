import { expect, test } from 'bun:test';
import {
  checkReplacement,
  preparationOutcome,
} from '@libs/runtime-server-ts/environment-release';
import {
  readPreparationPolicy,
  readReleasePolicy,
} from './environment-release-policy';

// regression: workspace-preparation-warning-policy
// regression: workspace-opening-facts-ignore-run-repair
test('the system setup warning still tells the team and permits opening', async () => {
  expect(preparationOutcome(await readPreparationPolicy())).toBe(
    'told-and-open'
  );
});

// regression: reusable-verifier-inherited-cancellation
test('Release keeps its running check when the shared verifier inherits concurrency', async () => {
  expect(checkReplacement(await readReleasePolicy(), 'release')).toBe('kept');
});
