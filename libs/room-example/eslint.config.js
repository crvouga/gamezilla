const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')
const eslintPluginGamezillaI18n = require('../eslint-rules/gamezilla-i18n.cjs')
const eslintPluginLingui = require('eslint-plugin-lingui')
const { linguiRules } = require('../eslint-rules/lingui-rules.cjs')
const banUnsafeAssertion = require('../eslint-rules/ban-unsafe-type-assertion.cjs')
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
      parserOptions: banUnsafeAssertion.parserOptions(__dirname),
    },
    plugins: {
      ...banUnsafeAssertion.plugins(),
      naming: eslintPluginNaming,
    },
    rules: {
      ...banUnsafeAssertion.rules(),
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
      'gamezillaI18n/text-must-be-trans': 'off',
      ...linguiRules(),
    },
  },
  sizeLimits.testOverrides(),
]
