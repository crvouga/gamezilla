import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { coverageWorkerEnv } from './check-coverage';
import type { FileCoverage, LcovRecord } from './lcov';
import { countLines, formatLcov, mergeInto, parseLcov } from './lcov';
import type { PackagePlan } from './packages';
import { listSourceFiles } from './packages';
import { formatPercent, summarizePackage } from './report';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const EQUAL_DIR = join(REPO_ROOT, 'pkgs/equal-shared');
const EQUAL_SOURCE = join(EQUAL_DIR, 'src/is-equal.ts');
const ASSERT_SOURCE = join(REPO_ROOT, 'pkgs/assert-root-shared/src/assert.ts');

// regression: coverage-nested-concurrency-oversubscribes-runner
test('coverage on two cores does not launch twenty concurrent tests per package', () => {
  expect(coverageWorkerEnv({}, 2, 4)['CHECK_TEST_CONCURRENCY']).toBe('1');
});

test('coverage shares its CPU ceiling and keeps a lower explicit test limit', () => {
  assertProperty(
    'coverage CPU ceiling',
    fc.property(
      fc.integer({ min: 1, max: 128 }),
      fc.integer({ min: 1, max: 16 }),
      fc.integer({ min: 1, max: 32 }),
      (cpus, jobs, limit) => {
        const env = {
          CHECK_TEST_CONCURRENCY: String(limit),
          CHECK_PROFILE: 'nightly',
        };
        const worker = coverageWorkerEnv(env, cpus, jobs);
        const count = Number(worker['CHECK_TEST_CONCURRENCY']);
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(limit);
        expect(count).toBeLessThanOrEqual(Math.max(1, Math.floor(cpus / jobs)));
        expect(worker['CHECK_PROFILE']).toBe('nightly');
        expect(env['CHECK_TEST_CONCURRENCY']).toBe(String(limit));
      }
    )
  );
});

function firstRecord(text: string, baseDir: string): LcovRecord {
  const [record] = parseLcov(text, baseDir);
  if (record === undefined) throw new Error('expected one lcov record');
  return record;
}

function planFor(dir: string, name: string): PackagePlan {
  return {
    name,
    tier: 'pkgs',
    dir,
    coverageRoot: join(dir, '.cache/coverage'),
    commands: ['bun test'],
  };
}

function recordFor(lines: readonly (readonly [number, number])[]): string {
  const body = lines.map(([line, hits]) => `DA:${line},${hits}`).join('\n');
  return `TN:\nSF:src/is-equal.ts\nFNF:2\nFNH:1\n${body}\nend_of_record\n`;
}

function indexOf(record: LcovRecord): Map<string, FileCoverage> {
  const index = new Map<string, FileCoverage>();
  mergeInto(index, record);
  return index;
}

describe('parseLcov', () => {
  test('resolves workspace-relative SF paths against the run cwd', () => {
    const text = [
      'TN:',
      'SF:src/is-equal.ts',
      'FNF:2',
      'FNH:1',
      'DA:1,3',
      'DA:2,0',
      'LF:2',
      'LH:1',
      'end_of_record',
      'TN:',
      'SF:../assert-root-shared/src/assert.ts',
      'DA:5,1',
      'LF:1',
      'LH:1',
      'end_of_record',
      '',
    ].join('\n');
    const records = parseLcov(text, EQUAL_DIR);
    expect(records.map((record) => record.path)).toEqual([
      EQUAL_SOURCE,
      ASSERT_SOURCE,
    ]);
    expect(countLines(records[0]?.coverage)).toEqual({ found: 2, hit: 1 });
    expect(records[0]?.coverage.functionsFound).toBe(2);
    expect(records[0]?.coverage.functionsHit).toBe(1);
  });
});

describe('mergeInto', () => {
  test('unions lines across runs so any covering run wins', () => {
    const index = indexOf(
      firstRecord(
        recordFor([
          [1, 0],
          [2, 4],
        ]),
        EQUAL_DIR
      )
    );
    mergeInto(
      index,
      firstRecord(
        'TN:\nSF:src/is-equal.ts\nFNF:2\nFNH:2\nDA:1,7\nDA:3,1\nend_of_record\n',
        EQUAL_DIR
      )
    );

    const merged = index.get(EQUAL_SOURCE);
    expect(countLines(merged)).toEqual({ found: 3, hit: 3 });
    expect([...(merged?.lines ?? [])]).toEqual([
      [1, 7],
      [2, 4],
      [3, 1],
    ]);
    expect(merged?.functionsHit).toBe(2);
  });
});

describe('listSourceFiles', () => {
  test('keeps sources and drops colocated test files', () => {
    expect(listSourceFiles(EQUAL_DIR)).toEqual([EQUAL_SOURCE]);
  });
});

describe('summarizePackage', () => {
  test('counts uncovered sources as unreached files with no lines', () => {
    expect(
      summarizePackage(planFor(EQUAL_DIR, '@pkgs/equal-shared'), new Map())
    ).toMatchObject({
      filesTotal: 1,
      filesReached: 0,
      linesFound: 0,
      linesHit: 0,
    });
  });

  test('rolls instrumented lines and reached files up per package', () => {
    const index = indexOf(
      firstRecord(
        recordFor([
          [1, 3],
          [2, 0],
        ]),
        EQUAL_DIR
      )
    );
    expect(
      summarizePackage(planFor(EQUAL_DIR, '@pkgs/equal-shared'), index)
    ).toMatchObject({
      filesTotal: 1,
      filesReached: 1,
      linesFound: 2,
      linesHit: 1,
      functionsFound: 2,
      functionsHit: 1,
    });
  });
});

describe('formatLcov', () => {
  test('writes repo-relative paths that reparse to the same files', () => {
    const index = indexOf(
      firstRecord(
        'TN:\nSF:../assert-root-shared/src/assert.ts\nDA:5,1\nend_of_record\n',
        EQUAL_DIR
      )
    );
    const reparsed = parseLcov(formatLcov(index, REPO_ROOT), REPO_ROOT);
    expect(reparsed.map((record) => record.path)).toEqual([ASSERT_SOURCE]);
    expect(countLines(reparsed[0]?.coverage)).toEqual({ found: 1, hit: 1 });
  });
});

describe('formatPercent', () => {
  test('renders one decimal and a placeholder for an empty set', () => {
    expect(formatPercent(1, 3)).toBe('33.3%');
    expect(formatPercent(0, 0)).toBe('-');
  });
});
