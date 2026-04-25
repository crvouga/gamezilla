const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')
const eslintPluginGamezillaText = require('../eslint-rules/gamezilla-text.cjs')
const sizeLimits = require('../eslint-rules/size-limits.cjs')

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
      gamezillaText: eslintPluginGamezillaText,
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
      'gamezillaText/text-use-label': 'error',
    },
  },
  sizeLimits.testOverrides(),
]
