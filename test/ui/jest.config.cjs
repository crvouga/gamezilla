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
  testTimeout: 120_000,
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
    // nested install breaks the upstream mock entry (falls back to `{}`).
    // Use distinct files so the jest.mock factory does not require the same
    // module id it is replacing (empty circular exports).
    '^react-native-reanimated$': '<rootDir>/jest-reanimated-stub.cjs',
    '^react-native-reanimated/mock$': '<rootDir>/jest-reanimated-mock-stub.cjs',
    '^@gorhom/bottom-sheet$': '<rootDir>/jest-bottom-sheet-stub.cjs',
    '^expo-audio$': '<rootDir>/jest-expo-audio-stub.cjs',
    '^expo-network$': '<rootDir>/jest-expo-network-stub.cjs',
    '^expo-dev-client$': '<rootDir>/jest-expo-dev-client-stub.cjs',
    // Force one Lingui core singleton (Bun nests two hashes otherwise).
    '^@lingui/core$': require.resolve('@lingui/core', {
      paths: [path.join(repoRoot, 'apps/client')],
    }),
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/jest-async-storage-stub.cjs',
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
