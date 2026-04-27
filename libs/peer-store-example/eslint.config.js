const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')
const eslintPluginGamezillaText = require('../eslint-rules/gamezilla-text.cjs')
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
      gamezillaText: eslintPluginGamezillaText,
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
      'gamezillaText/text-use-label': 'error',
      'no-restricted-syntax': ['error', ...a11yRestrictions.restrictedSyntax()],
    },
  },
  sizeLimits.testOverrides(),
]
