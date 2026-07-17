const {
  createSharedBlocks,
} = require('../../pkgs/eslint-rules/base-config.cjs');
const { linguiRules } = require('../../pkgs/eslint-rules/lingui-rules.cjs');
const eslintPluginWorkspaceI18n = require('../../pkgs/eslint-rules/lingui-text.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');

const forbidExportStar = {
  selector: 'ExportAllDeclaration',
  message:
    'Wildcard re-exports are forbidden in @pkgs/inbox. Use explicit named exports.',
};

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', forbidExportStar],
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
      'lingui/t-call-in-function': 'off',
      'workspaceI18n/text-must-be-trans': 'off',
    },
  },
];
