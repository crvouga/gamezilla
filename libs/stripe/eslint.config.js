const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['scripts/**/*.ts', 'src/sync/**/*.ts'],
    rules: {
      'max-statements': 'off',
      complexity: 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
    },
  },
];
