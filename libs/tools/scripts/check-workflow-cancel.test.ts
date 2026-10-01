import { describe, expect, test } from 'bun:test';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW = join(
  import.meta.dirname,
  '../../../.github/workflows/check.yml'
);

/** Job-level `if:` lines (4-space indent). Step conditions sit deeper. */
function jobConditions(workflow: string): readonly string[] {
  return [...workflow.matchAll(/^ {4}if: (.+)$/gm)].map(
    (match) => match[1] ?? ''
  );
}

describe('Check workflow cancellation', () => {
  // regression: check-cancel-holds-concurrency
  test('publish and the verdict skip a cancelled run', () => {
    const holding = jobConditions(readFileSync(WORKFLOW, 'utf8')).filter(
      (condition) => condition.includes('always()')
    );
    expect(holding).toEqual([
      "always() && !cancelled() && needs.check-matrix.result == 'success' && needs.check-publish-open.result == 'success'",
      "always() && !cancelled() && needs.check-publish-open.result == 'success'",
      'always() && !cancelled()',
    ]);
  });
});
