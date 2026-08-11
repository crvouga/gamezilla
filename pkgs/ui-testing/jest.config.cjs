const {
  bunAwareTransformIgnorePatterns,
} = require('./jest-transform-ignore.cjs');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/src/drivers/in-process/**/*.test.ts',
    '<rootDir>/src/drivers/in-process/**/*.test.tsx',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30_000,
  transformIgnorePatterns: bunAwareTransformIgnorePatterns(),
  forceExit: true,
};
