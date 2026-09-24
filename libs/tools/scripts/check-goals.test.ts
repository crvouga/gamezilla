import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GoalChecks, KnownBug } from '../goal/goal-manifest';
import { validateGoalGate } from '../goal/goal-manifest';
import { parseGoalMarkdown } from '../goal/goal-statements';

const ROOT = join(import.meta.dirname, '../../..');

function readRepoFile(path: string): string | null {
  try {
    return readFileSync(join(ROOT, path), 'utf8');
  } catch {
    return null;
  }
}

const FIXTURE = `# Definition of done
<!-- marker -->
## 1. The bar
- [ ] first statement
- [x] second statement
## 2. Spaces
- [ ] only statement
# Not in v1
- [ ] not a goal statement
`;

describe('parseGoalMarkdown', () => {
  test('collects definition-of-done checkboxes with section-scoped ids', () => {
    expect(parseGoalMarkdown(FIXTURE)).toEqual([
      {
        id: 'the-bar:1',
        section: 'the-bar',
        ordinal: 1,
        text: 'first statement',
        checked: false,
      },
      {
        id: 'the-bar:2',
        section: 'the-bar',
        ordinal: 2,
        text: 'second statement',
        checked: true,
      },
      {
        id: 'spaces:1',
        section: 'spaces',
        ordinal: 1,
        text: 'only statement',
        checked: false,
      },
    ]);
  });

  test('ignores the goals preamble and everything after Not in v1', () => {
    const markdown = `# The goal\n- [ ] preamble\n${FIXTURE}`;
    const ids = parseGoalMarkdown(markdown).map((s) => s.id);
    expect(ids).toEqual(['the-bar:1', 'the-bar:2', 'spaces:1']);
  });
});

describe('validateGoalGate', () => {
  const statements = parseGoalMarkdown(FIXTURE);
  const base = {
    statements,
    knownBugs: [] as readonly KnownBug[],
    proofFiles: { owns: () => true, read: readRepoFile },
    unprovenBudget: 2,
  };

  test('reports a statement with no manifest entry', () => {
    const checks: GoalChecks = {
      'the-bar:2': { status: 'proven', proofs: [] },
      'spaces:1': { status: 'unproven', note: 'not started' },
    };
    expect(validateGoalGate({ ...base, checks }).join('\n')).toContain(
      'the-bar:1: GOAL.md statement has no goal-checks.json entry'
    );
  });

  test('reports a checkbox that disagrees with the manifest status', () => {
    const checks: GoalChecks = {
      'the-bar:1': { status: 'proven', proofs: [] },
      'the-bar:2': { status: 'unproven', note: 'regressed' },
      'spaces:1': { status: 'unproven', note: 'not started' },
    };
    const errors = validateGoalGate({ ...base, checks }).join('\n');
    expect(errors).toContain('the-bar:1: GOAL.md checkbox is unchecked');
    expect(errors).toContain('the-bar:2: GOAL.md checkbox is checked');
  });

  test('reports a proof file that does not carry the marker', () => {
    const checks: GoalChecks = {
      'the-bar:1': {
        status: 'unproven',
        note: 'x',
      },
      'the-bar:2': {
        status: 'proven',
        proofs: [{ kind: 'test', path: 'libs/tools/package.json' }],
      },
      'spaces:1': { status: 'unproven', note: 'x' },
    };
    expect(validateGoalGate({ ...base, checks }).join('\n')).toContain(
      'libs/tools/package.json does not contain marker "goal:the-bar:2"'
    );
  });

  test('reports a missing proof file, an empty proof list and an empty note', () => {
    const checks: GoalChecks = {
      'the-bar:1': { status: 'unproven', note: '   ' },
      'the-bar:2': { status: 'proven', proofs: [] },
      'spaces:1': {
        status: 'unproven',
        note: 'x',
      },
    };
    const errors = validateGoalGate({ ...base, checks }).join('\n');
    expect(errors).toContain(
      'the-bar:2: proven entry needs at least one proof'
    );
    expect(errors).toContain('the-bar:1: unproven entry needs a note');
  });

  test('reports unproven count above the budget', () => {
    const checks: GoalChecks = {
      'the-bar:1': { status: 'unproven', note: 'x' },
      'the-bar:2': { status: 'unproven', note: 'x' },
      'spaces:1': { status: 'unproven', note: 'x' },
    };
    expect(
      validateGoalGate({ ...base, checks, unprovenBudget: 2 }).join('\n')
    ).toContain('unproven budget exceeded: 3 unproven statements, budget is 2');
  });

  test('accepts a fully proven manifest', () => {
    const proof = {
      kind: 'test' as const,
      path: 'libs/tools/package.json',
      marker: 'name',
    };
    const checks: GoalChecks = {
      'the-bar:1': { status: 'proven', proofs: [proof] },
      'the-bar:2': { status: 'proven', proofs: [proof] },
      'spaces:1': { status: 'proven', proofs: [proof] },
    };
    const checkedStatements = statements.map((statement) => ({
      ...statement,
      checked: true,
    }));
    expect(
      validateGoalGate({ ...base, statements: checkedStatements, checks })
    ).toEqual([]);
  });

  describe('known bugs are guarded by example regression tests', () => {
    const checks: GoalChecks = {
      'the-bar:1': { status: 'unproven', note: 'x' },
      'the-bar:2': { status: 'proven', proofs: [] },
      'spaces:1': { status: 'unproven', note: 'x' },
    };
    const files = (body: string | null) => ({
      owns: () => true,
      read: () => body,
    });
    const gate = (bug: KnownBug, body: string | null) =>
      validateGoalGate({
        ...base,
        checks,
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
      ).toContain('regressionTest must be a *.test.ts(x) file');
    });
  });
});
