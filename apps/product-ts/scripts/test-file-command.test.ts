import { expect, test } from 'bun:test';
import { owningPackagePath, testFileCommand } from './test-file-command';

test('selected Solid tests retain compiler config in both supported flag forms', () => {
  // regression: solid-spec-launchers-implicit-tsconfig
  for (const flag of [
    '--tsconfig-override ../../tsconfig.json',
    '--tsconfig-override=../../tsconfig.json',
  ]) {
    expect(
      testFileCommand(
        'libs/profile-client-ts/tests/profile-avatar-figure.test.tsx',
        `bun test ${flag} --preload @pkgs/bun-test-solid-client-ts/preload tests`
      ).argv
    ).toEqual([
      'test',
      ...flag.split(' '),
      '--preload',
      '@pkgs/bun-test-solid-client-ts/preload',
      './tests/profile-avatar-figure.test.tsx',
    ]);
  }
});

// regression: randomized-tests-missing-package-runtime
test('profile replay keeps browser resolution and DOM preload in its package', () => {
  expect(
    testFileCommand(
      'libs/profile-client-ts/tests/use-synced-profiles.test.tsx',
      'bun test --conditions=browser --conditions=development --preload @pkgs/bun-test-solid-client-ts/preload tests'
    )
  ).toEqual({
    packagePath: 'libs/profile-client-ts',
    argv: [
      'test',
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      '@pkgs/bun-test-solid-client-ts/preload',
      './tests/use-synced-profiles.test.tsx',
    ],
  });
});

test('all package preloads retain their order and relative resolution', () => {
  expect(
    testFileCommand(
      'pkgs/chess-board-root-client-ts/tests/chess-board-input.test.tsx',
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

// regression: randomized-tests-windows-path-separators
test('a Windows-separated selection resolves to its owning package', () => {
  const file = 'libs\\profile-client-ts\\tests\\use-synced-profiles.test.tsx';
  expect(owningPackagePath(file)).toBe('libs/profile-client-ts');
  expect(testFileCommand(file, 'bun test --timeout 5000 tests')).toEqual({
    packagePath: 'libs/profile-client-ts',
    argv: ['test', '--timeout', '5000', './tests/use-synced-profiles.test.tsx'],
  });
});
