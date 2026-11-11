import { expect, test } from 'bun:test';
import {
  generatedConflictHint,
  planGeneratedConflicts,
} from './generated-conflicts';

test('generated files are rebuilt, everything else stays manual', () => {
  const plan = planGeneratedConflicts([
    'bun.lock',
    'libs/app-root-shared-ts/locales/en/messages.po',
    'libs/chess-client-ts/biome-scope.json',
    'README.md',
  ]);
  expect(plan.generated.map((entry) => entry.path)).toEqual([
    'bun.lock',
    'libs/app-root-shared-ts/locales/en/messages.po',
    'libs/chess-client-ts/biome-scope.json',
  ]);
  expect(plan.manual).toEqual(['README.md']);
  expect(plan.rebuilds).toEqual([
    ['bun', 'install'],
    ['bun', 'run', 'i18n:compile'],
    ['bun', 'run', 'cache:sync'],
  ]);
});

test('each rebuild runs once, however many of its files conflicted', () => {
  const plan = planGeneratedConflicts([
    'libs/a-client-ts/biome-scope.json',
    'libs/b-client-ts/biome-scope.json',
    'biome.shared.json',
  ]);
  expect(plan.manual).toEqual([]);
  expect(plan.rebuilds).toEqual([['bun', 'run', 'cache:sync']]);
});

test('a hand-written lookalike is not treated as generated', () => {
  const plan = planGeneratedConflicts([
    'docs/bun.lock.md',
    'libs/app-root-shared-ts/locales/en/messages.ts.bak',
    'biome.json',
  ]);
  expect(plan.generated).toEqual([]);
  expect(plan.manual).toHaveLength(3);
});

test('the hint settles each generated file before rebuilding', () => {
  const hint = generatedConflictHint(
    planGeneratedConflicts([
      'bun.lock',
      'libs/app-root-shared-ts/locales/en/messages.po',
    ])
  );
  expect(hint).toContain('git checkout --theirs -- bun.lock');
  expect(hint).toContain('before committing the merge');
  expect(hint).toContain(
    'git rm --cached --quiet -- libs/app-root-shared-ts/locales/en/messages.po'
  );
  expect(hint.indexOf('bun install')).toBeGreaterThan(
    hint.indexOf('git checkout --theirs')
  );
  expect(generatedConflictHint(planGeneratedConflicts(['README.md']))).toBe('');
});

test('once settled, the hint only asks for the rebuild', () => {
  const hint = generatedConflictHint(
    planGeneratedConflicts(['bun.lock', 'README.md']),
    true
  );
  expect(hint).not.toContain('git checkout');
  expect(hint).toContain('settled to trunk');
  expect(hint).toContain('  bun install');
});
