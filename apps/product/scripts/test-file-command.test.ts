import { expect, test } from 'bun:test';
import { testFileCommand } from './test-file-command';

// regression: randomized-tests-missing-package-runtime
test('profile replay keeps browser resolution and DOM preload in its package', () => {
  expect(
    testFileCommand(
      'libs/profile-client/tests/use-synced-profiles.test.tsx',
      'bun test --conditions=browser --conditions=development --preload @pkgs/bun-test-solid-client/preload tests'
    )
  ).toEqual({
    packagePath: 'libs/profile-client',
    argv: [
      'test',
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      '@pkgs/bun-test-solid-client/preload',
      './tests/use-synced-profiles.test.tsx',
    ],
  });
});

test('all package preloads retain their order and relative resolution', () => {
  expect(
    testFileCommand(
      'pkgs/chess-board-root-client/tests/chess-board-input.test.tsx',
      'bun test --preload=dom --preload ./src/board-style-preload.ts --parallel=1 --timeout 120000 tests'
    ).argv
  ).toEqual([
    'test',
    '--preload=dom',
    '--preload',
    './src/board-style-preload.ts',
    '--parallel=1',
    '--timeout',
    '120000',
    './tests/chess-board-input.test.tsx',
  ]);
});
