// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginWorkspaceI18n = require('../../pkgs/eslint-rules/lingui-text.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const {
  createSharedBlocks,
} = require('../../pkgs/eslint-rules/base-config.cjs');
const { linguiRules } = require('../../pkgs/eslint-rules/lingui-rules.cjs');
const a11yRestrictions = require('../../pkgs/eslint-rules/a11y-restrictions.cjs');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'src/i18n/locales/**/messages.ts'],
  },
  {
    settings: {
      'import/core-modules': ['bun:test'],
    },
  },
  ...createSharedBlocks(__dirname, {
    mergeWithExpo: true,
    namingIgnore: [
      '^index\\.(ts|tsx|js|jsx)$',
      '^_layout\\.(ts|tsx|js|jsx)$',
      '^\\[.*\\]\\.(ts|tsx|js|jsx)$',
      '\\.(ios|android|web)\\.(ts|tsx|js|jsx)$',
    ],
  }),
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-status-bar',
              message: 'Use AppStatusBar from @pkgs/ui.',
            },
            {
              name: 'expo-splash-screen',
              message: 'Use preventSplashAutoHide or hideSplash from @pkgs/ui.',
            },
            {
              name: 'expo-symbols',
              message: 'Use IconSymbol from @pkgs/ui.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        ...a11yRestrictions.restrictedSyntax(),
        {
          selector:
            'CallExpression > MemberExpression[object.type="AwaitExpression"]',
          message:
            'Avoid nesting await inside function calls. Extract to a variable first: const x = await ...; fn(x);',
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
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
    files: ['src/providers/app-providers.tsx'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'lingui/no-unlocalized-strings': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/**/*.test.*'],
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
]);
