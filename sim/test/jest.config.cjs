const path = require('node:path');

const {
  bunAwareTransformIgnorePatterns,
} = require('../../pkgs/ui-testing/jest-transform-ignore.cjs');

const repoRoot = path.join(__dirname, '../..');

// Bun nests multiple `react-native@0.83.10+<hash>` copies. jest-expo mocks
// NativeModules on the copy this package resolves; `@react-native/virtualized-lists`
// otherwise loads a different copy and crashes with
// `__fbBatchedBridgeConfig is not set` (Reanimated mock → FlatList).
const reactNativeRoot = path.dirname(
  require.resolve('react-native/package.json', { paths: [__dirname] })
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/src/scenarios/**/*.sim.test.ts',
    '<rootDir>/src/scenarios/**/*.sim.test.tsx',
    '<rootDir>/src/scenario/**/*.test.ts',
  ],
  setupFiles: ['<rootDir>/jest.setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  // UI waits default to 2–5s fail-fast ceilings; keep headroom for boot.
  testTimeout: 30_000,
  // Narrow allowlist (shared with @pkgs/ui-testing): transform RN/Expo/Bun-nested
  // ESM that Jest cannot load as-is. Everything else — including better-sqlite3
  // (native addon) — stays untransformed.
  transformIgnorePatterns: bunAwareTransformIgnorePatterns([
    '@shopify/react-native-skia',
  ]),
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
      require.resolve('babel-jest'),
      {
        // Let babel-preset-expo apply CJS transforms (do not claim metro ESM).
        caller: { name: 'babel-jest', bundler: 'jest', platform: 'ios' },
        configFile: path.join(__dirname, 'babel.jest.config.js'),
      },
    ],
  },
  // Jest 29 does not honor package.json "exports" the way Bun/Metro do.
  moduleNameMapper: {
    '^react-native$': require.resolve('react-native', { paths: [__dirname] }),
    '^react-native/(.*)$': `${reactNativeRoot}/$1`,
    // expo-router/testing-library jest.mocks reanimated → `…/mock`. Bun's
    // nested install can fail that subpath (factory falls back to `{}`).
    // Bridge file ≠ `/mock` module id (avoids circular empty exports) but both
    // load the library's compiled mock — no hand-rolled API stub.
    '^react-native-reanimated$': '<rootDir>/jest-reanimated-bridge.cjs',
    '^react-native-reanimated/mock$': require.resolve(
      'react-native-reanimated/lib/module/mock',
      { paths: [path.join(repoRoot, 'apps/client')] }
    ),
    '^react-native-worklets$': require.resolve('react-native-worklets', {
      paths: [path.join(repoRoot, 'apps/client')],
    }),
    '^react-native-worklets/lib/module/mock$': require.resolve(
      'react-native-worklets/lib/module/mock',
      { paths: [path.join(repoRoot, 'apps/client')] }
    ),
    // Expo.fx requires `./async-require/messageSocket` (resolves .native).
    // Map every copy so Metro HMR never opens ws://localhost:8081/message.
    'async-require[/\\\\]messageSocket(\\.native)?$':
      '<rootDir>/jest-expo-message-socket-stub.cjs',
    // Force one Lingui core singleton (Bun nests two hashes otherwise).
    '^@lingui/core$': require.resolve('@lingui/core', {
      paths: [path.join(repoRoot, 'apps/client')],
    }),
    '^@shopify/react-native-skia$': '<rootDir>/jest-skia-mock.cjs',
    '^@legendapp/list$': '<rootDir>/jest-legend-list-mock.cjs',
    '^@legendapp/list/(.*)$': '<rootDir>/jest-legend-list-mock.cjs',
    '^@apps/([^/]+)$': `${repoRoot}/apps/$1/src/index.ts`,
    '^@apps/([^/]+)/(.*)$': `${repoRoot}/apps/$1/src/$2`,
    '^@sim/([^/]+)$': `${repoRoot}/sim/$1/src/index.ts`,
    '^@sim/([^/]+)/(.*)$': `${repoRoot}/sim/$1/src/$2`,
    '^@libs/([^/]+)$': `${repoRoot}/libs/$1/src/index.ts`,
    '^@libs/([^/]+)/(.*)$': `${repoRoot}/libs/$1/src/$2`,
    '^@pkgs/([^/]+)$': `${repoRoot}/pkgs/$1/src/index.ts`,
    '^@pkgs/([^/]+)/(.*)$': `${repoRoot}/pkgs/$1/src/$2`,
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json'],
  // Pin under the package (not OS /tmp) so CI can persist it and so macOS
  // tmp purge mid-run cannot ENOENT write-file-atomic renames.
  cacheDirectory: path.join(__dirname, '.cache/jest'),
  globalSetup: '<rootDir>/jest.global-setup.cjs',
};
