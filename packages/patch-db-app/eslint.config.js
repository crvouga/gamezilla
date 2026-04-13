const tsParser = require('@typescript-eslint/parser')
const eslintPluginNaming = require('eslint-plugin-naming')

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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              message:
                'Import UI from @gamezilla/shared/ui or @gamezilla/shared/theme.',
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
    },
  },
  {
    files: ['src/use-playground-boot.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]
