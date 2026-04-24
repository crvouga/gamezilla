const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')
const banUnsafeAssertion = require('../eslint-rules/ban-unsafe-type-assertion.cjs')

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
      'naming/case': [
        'error',
        {
          match: ['kebab'],
          validateFolders: false,
          ignore: ['^index\\.(ts|tsx|js|jsx)$'],
        },
      ],
    },
  },
]
