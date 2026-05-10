const {
  createSharedBlocks,
} = require('../eslint-rules/base-config.cjs');

module.exports = [
  ...createSharedBlocks(__dirname, { filesGlob: 'src/**/*.{ts,tsx}' }),
  {
    files: ['src/cli/**/*.ts'],
    rules: {
      complexity: 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'max-classes-per-file': 'off',
      'no-console': 'off',
    },
  },
];
