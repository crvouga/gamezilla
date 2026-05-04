const eslintPluginGamezillaI18n = require('../eslint-rules/gamezilla-i18n.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');
const { linguiRules } = require('../eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['src/logger/logger.ts', '**/*.bench.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/async/use-async.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      gamezillaI18n: eslintPluginGamezillaI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      'gamezillaI18n/text-must-be-trans': 'off',
      ...linguiRules(),
      // Design-system internals: product copy is enforced in apps/client.
      'lingui/no-unlocalized-strings': 'off',
    },
  },
  {
    files: ['src/dependency-injection/component-system.ts'],
    rules: {
      'max-classes-per-file': 'off',
      'max-statements': 'off',
      complexity: 'off',
    },
  },
  {
    files: ['src/dependency-injection/component-system.test.ts'],
    rules: {
      'max-classes-per-file': 'off',
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
