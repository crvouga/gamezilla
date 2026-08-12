const path = require('node:path');

const {
  bunAwareTransformIgnorePatterns,
} = require('../ui-testing/jest-transform-ignore.cjs');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/src/tests/**/*.ui.test.ts',
    '<rootDir>/src/tests/**/*.ui.test.tsx',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: bunAwareTransformIgnorePatterns(),
  cacheDirectory: path.join(__dirname, '.cache/jest'),
  forceExit: true,
};
