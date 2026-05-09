const {
  createSharedBlocks,
} = require('../../libs/eslint-rules/base-config.cjs');

module.exports = [
  ...createSharedBlocks(__dirname, {
    filesGlob: '{src,scripts}/**/*.{ts,tsx}',
  }),
  {
    files: ['src/sql-app.ts'],
    rules: {
      complexity: 'off',
      'max-statements': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['scripts/seed-chess-puzzles.ts'],
    rules: {
      complexity: 'off',
      'max-statements': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['scripts/seed-chess-puzzles-reporter.ts'],
    rules: {
      complexity: 'off',
      'max-lines-per-function': 'off',
    },
  },
];
