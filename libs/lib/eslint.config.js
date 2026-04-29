const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')
const eslintPluginGamezillaI18n = require('../eslint-rules/gamezilla-i18n.cjs')
const eslintPluginLingui = require('eslint-plugin-lingui')
const { linguiRules } = require('../eslint-rules/lingui-rules.cjs')
const sizeLimits = require('../eslint-rules/size-limits.cjs')
const a11yRestrictions = require('../eslint-rules/a11y-restrictions.cjs')

module.exports = [
  {
    ignores: ['dist/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      naming: eslintPluginNaming,
    },
    rules: {
      ...sizeLimits.rules(),
      'naming/case': [
        'error',
        {
          match: ['kebab'],
          validateFolders: false,
          ignore: ['^index\\.(ts|tsx|js|jsx)$'],
        },
      ],
      'no-restricted-syntax': ['error', ...a11yRestrictions.restrictedSyntax()],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      gamezillaI18n: eslintPluginGamezillaI18n,
      lingui: eslintPluginLingui,
    },
    rules: {
      // `Text` is defined here; examples and internals use string labels by design.
      // Product copy is enforced in `apps/client` + `LocalizedString` on primitives.
      'gamezillaI18n/text-must-be-trans': 'off',
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
  sizeLimits.testOverrides(),
]
