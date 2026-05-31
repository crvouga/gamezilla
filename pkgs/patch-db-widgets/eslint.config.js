const eslintPluginWorkspaceI18n = require('../../pkgs/eslint-rules/lingui-text.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const {
  createSharedBlocks,
} = require('../../pkgs/eslint-rules/base-config.cjs');
const { linguiRules } = require('../../pkgs/eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.tsx'],
    plugins: {
      workspaceI18n: eslintPluginWorkspaceI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      'workspaceI18n/text-must-be-trans': 'off',
      ...linguiRules(),
      'lingui/no-unlocalized-strings': 'off',
    },
  },
  {
    files: ['src/use-playground-boot.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/db-client/navigator.tsx'],
    rules: {
      'max-lines': 'off',
    },
  },
];
