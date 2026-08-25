const path = require('node:path');

const {
  bunAwareTransformIgnorePatterns,
} = require('./jest-transform-ignore.cjs');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/src/drivers/rntl/**/*.test.ts',
    '<rootDir>/src/drivers/rntl/**/*.test.tsx',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30_000,
  transformIgnorePatterns: bunAwareTransformIgnorePatterns(),
  cacheDirectory: path.join(__dirname, '.cache/jest'),
};
