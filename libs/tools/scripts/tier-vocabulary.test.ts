import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/** The policy package and billing are the only places tier vocabulary lives. */
const ALLOWLIST = [
  'libs/permissions',
  'pkgs/permissions',
  'libs/billing',
  'pkgs/billing*',
  'apps/product/src/sim/system/billing-*.ts',
  'apps/product/tests/billing-*.test.tsx',
  // The lint rule itself and this test name the denylist.
  'libs/tools',
];

/** Distinctive tier identifiers plus `plan:` role literals (§22.11). */
const DENYLIST =
  '\\b(isPremium|isPro|isPaid|isGuest|isFree|isPlus|subscriptionLevel|usePlanRole|PlanRole|planGuest|planFree|planPaid|resolvePlanRole)\\b|[\'"`]plan:';

function grepHits(pattern: string, pathspecs: readonly string[]): string[] {
  try {
    const out = execFileSync(
      'git',
      [
        'grep',
        '-n',
        '-E',
        pattern,
        '--',
        ...pathspecs,
        ...ALLOWLIST.map((path) => `:(exclude,glob)${path}/**`),
        ...ALLOWLIST.map((path) => `:(exclude,glob)${path}`),
      ],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    return out.split('\n').filter((line) => line.length > 0);
  } catch (error) {
    // git grep exits 1 when nothing matches.
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }
}

describe('§22.11 no tier coupling outside policy/ and billing/', () => {
  test('denylisted tier identifiers and plan literals: zero hits', () => {
    expect(
      grepHits(DENYLIST, [
        ':(glob)libs/**/*.ts',
        ':(glob)libs/**/*.tsx',
        ':(glob)apps/**/*.ts',
        ':(glob)apps/**/*.tsx',
        ':(glob)pkgs/**/*.ts',
        ':(glob)pkgs/**/*.tsx',
      ])
    ).toEqual([]);
  });

  test('puzzle feature: no bare tier words as identifiers (declarations)', () => {
    expect(
      grepHits(
        '\\b(const|let|var|function|type|interface)\\s+(tier|plan|free|guest|premium|pro|plus)\\b',
        [':(glob)libs/chess/src/**/*.ts', ':(glob)libs/chess/src/**/*.tsx']
      )
    ).toEqual([]);
  });

  test('the Grit rules are registered with the same allowlist', () => {
    const biome = readFileSync(join(REPO_ROOT, 'biome.json'), 'utf8');
    for (const plugin of [
      'no-tier-vocabulary.grit',
      'no-tier-vocabulary-string.grit',
      'no-tier-words-puzzle.grit',
    ]) {
      expect(biome).toContain(`./libs/tools/biome-plugins/${plugin}`);
    }
    for (const path of [
      'libs/permissions',
      'pkgs/permissions',
      'libs/billing',
    ]) {
      expect(biome).toContain(`"!**/${path}/**"`);
    }
  });
});
