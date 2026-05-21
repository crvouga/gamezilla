const eslintPluginGamezillaI18n = require('../eslint-rules/gamezilla-i18n.cjs');
const eslintPluginGamezillaText = require('../eslint-rules/gamezilla-text.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');
const { linguiRules } = require('../eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      gamezillaText: eslintPluginGamezillaText,
    },
    rules: {
      'gamezillaText/text-use-label': 'error',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      gamezillaI18n: eslintPluginGamezillaI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      'gamezillaI18n/text-must-be-trans': 'error',
      ...linguiRules(),
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'lingui/no-unlocalized-strings': 'off',
      'lingui/t-call-in-function': 'off',
      'lingui/no-trans-inside-trans': 'off',
      'lingui/no-expression-in-message': 'off',
      'lingui/no-single-tag-to-translate': 'off',
      'lingui/no-single-variables-to-translate': 'off',
      'gamezillaI18n/text-must-be-trans': 'off',
    },
  },
];
