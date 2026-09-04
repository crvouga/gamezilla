const path = require('node:path');

const {
  bunAwareTransformIgnorePatterns,
} = require('../ui-testing/jest-transform-ignore.cjs');

const repoRoot = path.join(__dirname, '../..');

const reactNativeRoot = path.dirname(
  require.resolve('react-native/package.json', { paths: [__dirname] })
);

const babelRuntimeRoot = path.dirname(
  require.resolve('@babel/runtime/package.json', { paths: [__dirname] })
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30_000,
  setupFiles: ['<rootDir>/jest.setup-env.cjs'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  transformIgnorePatterns: bunAwareTransformIgnorePatterns([
    '@shopify/react-native-skia',
    'react-native-gesture-handler',
    'react-native-reanimated',
    'react-native-worklets',
    'react-native-screens',
    'chess.js',
  ]),
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': [
      require.resolve('babel-jest'),
      {
        caller: { name: 'babel-jest', bundler: 'jest', platform: 'ios' },
        configFile: path.join(__dirname, 'babel.jest.config.js'),
      },
    ],
  },
  cacheDirectory: path.join(__dirname, '.cache/jest'),
  moduleNameMapper: {
    '^react-native$': require.resolve('react-native', { paths: [__dirname] }),
    '^react-native/(.*)$': `${reactNativeRoot}/$1`,
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
    '^@shopify/react-native-skia$': '<rootDir>/jest-skia-mock.cjs',
    '^@babel/runtime/(.*)$': `${babelRuntimeRoot}/$1`,
    '^@pkgs/([^/]+)$': `${repoRoot}/pkgs/$1/src/index.ts`,
    '^@pkgs/([^/]+)/(.*)$': `${repoRoot}/pkgs/$1/src/$2`,
  },
};
