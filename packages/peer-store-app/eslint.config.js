const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')
const eslintPluginGamezillaText = require('../../eslint-rules/gamezilla-text.cjs')

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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              message:
                'Import UI and layout from @gamezilla/shared/ui or @gamezilla/shared/theme.',
            },
            {
              name: 'react-native-svg',
              message: 'Import vector primitives from @gamezilla/shared/ui/svg.',
            },
          ],
        },
      ],
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
]
