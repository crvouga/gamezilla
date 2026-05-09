const {
  createSharedBlocks,
} = require('../../libs/eslint-rules/base-config.cjs');

module.exports = [
  ...createSharedBlocks(__dirname, {
    filesGlob: '{src,scripts}/**/*.{ts,tsx}',
  }),
  {
    files: ['{src,scripts}/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
