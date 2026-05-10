const {
  createSharedBlocks,
} = require('../eslint-rules/base-config.cjs');

module.exports = [
  ...createSharedBlocks(__dirname, { filesGlob: 'src/**/*.{ts,tsx}' }),
  {
    files: ['src/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
