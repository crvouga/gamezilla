const eslintPluginGamezillaI18n = require('../eslint-rules/gamezilla-i18n.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');
const { linguiRules } = require('../eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.tsx'],
    plugins: {
      gamezillaI18n: eslintPluginGamezillaI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      'gamezillaI18n/text-must-be-trans': 'off',
      ...linguiRules(),
      'lingui/no-unlocalized-strings': 'off',
    },
  },
];
