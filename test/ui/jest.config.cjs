const path = require('node:path');

const repoRoot = path.join(__dirname, '../..');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/src/scenarios/**/*.sim.test.ts',
    '<rootDir>/src/scenarios/**/*.sim.test.tsx',
  ],
  setupFiles: ['<rootDir>/jest.setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  testTimeout: 180_000,
  // Transform all node_modules so Bun-nested ESM (.mjs / "export") loads under Jest.
  transformIgnorePatterns: [],
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
      require.resolve('babel-jest'),
      {
        // Let babel-preset-expo apply CJS transforms (do not claim metro ESM).
        caller: { name: 'babel-jest', bundler: 'jest', platform: 'ios' },
        configFile: path.join(__dirname, 'babel.config.js'),
      },
    ],
  },
  // Jest 29 does not honor package.json "exports" the way Bun/Metro do.
  moduleNameMapper: {
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
    '^@gorhom/bottom-sheet$': '<rootDir>/jest-bottom-sheet-stub.cjs',
    // Better Auth (not product code) dynamically imports expo-network and
    // requires subscription.remove(); keep a minimal shim for that path only.
    '^expo-network$': '<rootDir>/jest-expo-network-better-auth-shim.cjs',
    // Force one Lingui core singleton (Bun nests two hashes otherwise).
    '^@lingui/core$': require.resolve('@lingui/core', {
      paths: [path.join(repoRoot, 'apps/client')],
    }),
    '^@apps/([^/]+)$': `${repoRoot}/apps/$1/src/index.ts`,
    '^@apps/([^/]+)/(.*)$': `${repoRoot}/apps/$1/src/$2`,
    '^@libs/([^/]+)$': `${repoRoot}/libs/$1/src/index.ts`,
    '^@libs/([^/]+)/(.*)$': `${repoRoot}/libs/$1/src/$2`,
    '^@pkgs/([^/]+)$': `${repoRoot}/pkgs/$1/src/index.ts`,
    '^@pkgs/([^/]+)/(.*)$': `${repoRoot}/pkgs/$1/src/$2`,
    '^@test/([^/]+)$': `${repoRoot}/test/$1/src/index.ts`,
    '^@test/([^/]+)/(.*)$': `${repoRoot}/test/$1/src/$2`,
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json'],
  forceExit: true,
};
