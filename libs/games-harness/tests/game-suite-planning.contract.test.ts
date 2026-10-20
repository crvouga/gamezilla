import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptySuiteProblems } from '@libs/games-harness/game-conformance';
import { planCodeSuites } from './conformance/game-suite';

// regression: game-conformance-unregistered-suite
test('planning detects a suite that never enrolls, even without eligible games', async () => {
  const cache = join(import.meta.dir, '../.cache');
  mkdirSync(cache, { recursive: true });
  const directory = mkdtempSync(join(cache, 'unregistered-suite-'));
  mkdirSync(join(directory, 'conformance/rules'), { recursive: true });
  writeFileSync(
    join(directory, 'conformance/rules/unregistered.test.ts'),
    'export {};\n'
  );
  try {
    const planned = await planCodeSuites(directory);
    expect(planned).toEqual([
      {
        id: 'conformance/rules/unregistered',
        area: 'rules',
        registers: null,
      },
    ]);
    expect(emptySuiteProblems(planned)).toEqual([
      'conformance/rules/unregistered never calls forEveryGame — a conformance suite registers its cases through forEveryGame(import.meta.path, …)',
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
