const eslintPluginWorkspaceI18n = require('../../pkgs/eslint-rules/lingui-text.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const {
  createSharedBlocks,
} = require('../../pkgs/eslint-rules/base-config.cjs');
const { linguiRules } = require('../../pkgs/eslint-rules/lingui-rules.cjs');

/**
 * Patterns forbidden everywhere in `@pkgs/ui` EXCEPT under the HeroUI adapter.
 * Kept in sync with the `heroui-confined-to-adapter` depcruise rule.
 */
const HEROUI_RESTRICTED_PATTERNS = [
  {
    group: ['heroui-native', 'heroui-native/*'],
    message:
      'heroui-native may only be imported from pkgs/ui/src/adapters/heroui/**. Use the @pkgs/ui port surface elsewhere.',
  },
  {
    group: ['uniwind', 'uniwind/*'],
    message:
      'uniwind may only be imported from pkgs/ui/src/adapters/heroui/**.',
  },
  {
    group: ['tailwind-merge', 'tailwind-variants'],
    message:
      'tailwind-merge / tailwind-variants may only be imported from pkgs/ui/src/adapters/heroui/**.',
  },
];

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
      // Design-system internals: product copy is enforced in apps/client.
      'lingui/no-unlocalized-strings': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/adapters/heroui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: HEROUI_RESTRICTED_PATTERNS },
      ],
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
