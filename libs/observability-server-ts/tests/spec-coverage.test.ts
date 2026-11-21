// @io-wall-ok — reads which bounded contexts specs/ holds.
import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { metricIndicators } from '@libs/observability-server-ts/slo-indicators';
import {
  specCoverageIssues,
  unwatchedContexts,
} from '@libs/observability-server-ts/spec-coverage';
import { SYNTHETIC_CHECK_METRIC } from '@libs/observability-server-ts/synthetic-checks';
import { REPO_ROOT } from './specs';

function contextsWithBehavior(): readonly string[] {
  const specs = join(REPO_ROOT, 'specs');
  return readdirSync(specs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      readdirSync(join(specs, name)).some((file) => file.endsWith('.feature'))
    )
    .sort();
}

function countedChecks(): ReadonlySet<string> {
  return new Set(
    metricIndicators()
      .filter((i) => i.metric === SYNTHETIC_CHECK_METRIC.name)
      .flatMap((i) => i.scope.flatMap((m) => m.values))
  );
}

describe('every bounded context in specs/', () => {
  // regression: slo-context-without-live-check
  test('is watched by a live, alerted check, exempt with a reason, or listed as unwatched', () => {
    expect(
      specCoverageIssues({
        contexts: contextsWithBehavior(),
        countedChecks: countedChecks(),
      })
    ).toEqual([]);
  });

  test('a new context, or a check no objective counts, is refused', () => {
    const issues = specCoverageIssues({
      contexts: [...contextsWithBehavior(), 'brand-new'],
      countedChecks: new Set(),
    });
    expect(issues.some((i) => i.includes('specs/brand-new'))).toBe(true);
    expect(issues.some((i) => i.includes('no live objective'))).toBe(true);
  });

  // Only shrinks: remove a context once a live check watches it. Until this
  // is empty, no alert does not mean every context works in production.
  test('leaves only these contexts unwatched', () => {
    expect(unwatchedContexts()).toEqual([
      'friends',
      'observatory',
      'profile',
      'synthetic-population',
    ]);
  });
});
