import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DRIFT_STOP_SIGNALS } from '@libs/infra-shared-ts/drift-process-policy';

const SCRIPT = join(import.meta.dirname, '../scripts/drift-verify.ts');

// regression: tofu-drift-sigkill-abandons-lock
test('declared-environment drift interrupts before force-killing the process group', () => {
  const text = readFileSync(SCRIPT, 'utf8');
  expect(text).toContain('DRIFT_STOP_SIGNALS');
  expect(text).toContain(DRIFT_STOP_SIGNALS[0]);
  expect(text).toContain(DRIFT_STOP_SIGNALS[1]);
  expect(text).not.toMatch(/process\.kill\([^)]*['"]SIGKILL['"]\s*\)/);
});
