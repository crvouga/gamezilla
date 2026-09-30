import { describe, expect, test } from 'bun:test';

import type { KnownBug } from '../goal/goal-manifest';
import { validateGoalGate } from '../goal/goal-manifest';

describe('validateGoalGate', () => {
  const files = (body: string | null) => ({
    owns: () => true,
    read: () => body,
  });
  const gate = (bug: KnownBug, body: string | null) =>
    validateGoalGate({
      knownBugs: [bug],
      proofFiles: files(body),
    }).join('\n');

  test('a missing regression test is reported', () => {
    expect(
      gate({ id: 'bug-1', summary: 'x', regressionTest: 'a.test.ts' }, null)
    ).toContain('known-bugs:bug-1: regression test not found: a.test.ts');
  });

  test('the test must carry `regression: <id>`', () => {
    const bug = { id: 'bug-1', summary: 'x', regressionTest: 'a.test.ts' };
    expect(gate(bug, "test('x', () => {});")).toContain(
      'does not contain marker "regression: bug-1"'
    );
    expect(gate(bug, '// regression: bug-1\ntest(...)')).not.toContain(
      'known-bugs'
    );
  });

  test('a feature must tag the pinned scenario `@regression:<id>`', () => {
    const bug = { id: 'bug-1', summary: 'x', regressionTest: 'a.feature' };
    expect(gate(bug, 'Feature: x\n  # regression: bug-1\n')).toContain(
      'does not contain marker "@regression:bug-1"'
    );
    expect(
      gate(bug, 'Feature: x\n  @regression:bug-1\n  Scenario: y\n')
    ).not.toContain('known-bugs');
  });

  test('a property test is not a regression guard', () => {
    expect(
      gate(
        { id: 'bug-1', summary: 'x', regressionTest: 'a.property.test.ts' },
        '// regression: bug-1'
      )
    ).toContain('is a property test');
  });

  test('a non-test file is not a regression guard', () => {
    expect(
      gate(
        { id: 'bug-1', summary: 'x', regressionTest: 'src/a.ts' },
        '// regression: bug-1'
      )
    ).toContain('regressionTest must be a *.test.ts(x) or *.feature file');
  });

  test('an empty bug list is guarded', () => {
    expect(validateGoalGate({ knownBugs: [], proofFiles: files('') })).toEqual(
      []
    );
  });
});
