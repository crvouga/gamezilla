const eslintPluginGamezillaText = require('../eslint-rules/gamezilla-text.cjs');
const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      gamezillaText: eslintPluginGamezillaText,
    },
    rules: {
      'gamezillaText/text-use-label': 'error',
    },
  },
];
