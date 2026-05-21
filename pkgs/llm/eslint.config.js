const eslintPluginWorkspaceI18n = require('../../pkgs/eslint-rules/lingui-text.cjs');
const eslintPluginWorkspaceText = require('../../pkgs/eslint-rules/text-label.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const {
  createSharedBlocks,
} = require('../../pkgs/eslint-rules/base-config.cjs');
const { linguiRules } = require('../../pkgs/eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      workspaceText: eslintPluginWorkspaceText,
    },
    rules: {
      'workspaceText/text-use-label': 'error',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      workspaceI18n: eslintPluginWorkspaceI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      'workspaceI18n/text-must-be-trans': 'error',
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
      'workspaceI18n/text-must-be-trans': 'off',
    },
  },
];
