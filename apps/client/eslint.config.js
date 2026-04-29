// https://docs.expo.dev/guides/using-eslint/
// File naming: all source files must use kebab-case (naming/case rule below)
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginNaming = require('eslint-plugin-naming');
const eslintPluginGamezillaI18n = require('../../libs/eslint-rules/gamezilla-i18n.cjs');
const eslintPluginLingui = require('eslint-plugin-lingui');
const { linguiRules } = require('../../libs/eslint-rules/lingui-rules.cjs');
const sizeLimits = require('../../libs/eslint-rules/size-limits.cjs');
const a11yRestrictions = require('../../libs/eslint-rules/a11y-restrictions.cjs');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    settings: {
      'import/core-modules': ['bun:test'],
      'import/resolver': {
        typescript: true,
      },
    },
    plugins: {
      naming: eslintPluginNaming,
    },
    rules: {
      ...sizeLimits.rules(),
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-status-bar',
              message: 'Use AppStatusBar from @gamezilla/lib/ui.',
            },
            {
              name: 'expo-splash-screen',
              message:
                'Use preventSplashAutoHide or hideSplash from @gamezilla/lib/ui.',
            },
            {
              name: 'expo-symbols',
              message: 'Use IconSymbol from @gamezilla/lib/ui.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      eqeqeq: ['error', 'always'],
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
      'naming/case': [
        'error',
        {
          match: ['kebab'],
          validateFolders: false,
          ignore: [
            '^index\\.(ts|tsx|js|jsx)$',
            '^_layout\\.(ts|tsx|js|jsx)$',
            '^\\[.*\\]\\.(ts|tsx|js|jsx)$',
            '\\.(ios|android|web)\\.(ts|tsx|js|jsx)$',
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
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
    files: ['**/*.test.{ts,tsx}', 'src/**/*.test.*'],
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
  sizeLimits.testOverrides(),
]);
