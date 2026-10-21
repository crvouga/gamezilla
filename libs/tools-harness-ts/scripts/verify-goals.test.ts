import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { KnownBug } from '../goal/goal-manifest';
import { validateGoalGate, validateRegister } from '../goal/goal-manifest';
import { KNOWN_BUGS_DIR, readKnownBugs } from '../goal/known-bugs';

describe('readKnownBugs', () => {
  test('each file is one bug and its name is the id', () => {
    const root = mkdtempSync(join(tmpdir(), 'known-bugs-'));
    const dir = join(root, KNOWN_BUGS_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'bug-2.json'),
      JSON.stringify({ summary: 'y', regressionTest: 'b.test.ts' })
    );
    writeFileSync(join(dir, 'bug-1.json'), JSON.stringify({ summary: 'x' }));
    writeFileSync(join(dir, 'notes.md'), 'not a bug');
    expect(readKnownBugs(root)).toEqual([
      { id: 'bug-1', summary: 'x', regressionTest: '' },
      { id: 'bug-2', summary: 'y', regressionTest: 'b.test.ts' },
    ]);
  });
});

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

describe('validateRegister', () => {
  const bug = (id: string, regressionTest: string): KnownBug => ({
    id,
    summary: 'what broke',
    regressionTest,
  });

  // regression: known-bug-proof-in-renamed-package
  test('a proof left behind in a package that no longer exists is reported missing', () => {
    // `libs/chess-server` became `libs/chess-root-server-ts`; no package's lint
    // owned the old path, so the stale entry passed for a week.
    const moved = 'libs/chess-root-server-ts/tests/puzzle-load-job.test.ts';
    expect(
      validateRegister({
        knownBugs: [
          bug(
            'deploy-empty-chess-puzzle-catalog',
            'libs/chess-server/tests/puzzle-load-job.test.ts'
          ),
        ],
        read: (path) =>
          path === moved
            ? '// regression: deploy-empty-chess-puzzle-catalog'
            : null,
      })
    ).toEqual([
      'known-bugs:deploy-empty-chess-puzzle-catalog: regression test not found: libs/chess-server/tests/puzzle-load-job.test.ts',
    ]);
  });

  test('every proof is verified once, inside a package or outside the tiers', () => {
    const proofs = new Map([
      ['pkgs/a/tests/a.test.ts', '// regression: marked'],
      ['pkgs/a/tests/b.test.ts', 'no marker'],
      ['specs/chess/play.feature', '@regression:tagged'],
      ['vendor/atlas/tests/c.test.ts', 'no marker'],
    ]);
    expect(
      validateRegister({
        knownBugs: [
          bug('marked', 'pkgs/a/tests/a.test.ts'),
          bug('unmarked', 'pkgs/a/tests/b.test.ts'),
          bug('tagged', 'specs/chess/play.feature'),
          bug('vendored', 'vendor/atlas/tests/c.test.ts'),
        ],
        read: (path) => proofs.get(path) ?? null,
      })
    ).toEqual([
      'known-bugs:vendored: vendor/atlas/tests/c.test.ts does not contain marker "regression: vendored"',
      'known-bugs:unmarked: pkgs/a/tests/b.test.ts does not contain marker "regression: unmarked"',
    ]);
  });
});
