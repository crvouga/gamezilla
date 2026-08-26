const path = require('node:path');

const base = require('./jest.config.cjs');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/src/snapshots/**/*.snapshot.test.ts'],
  testTimeout: 120_000,
};
