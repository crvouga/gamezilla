// https://docs.expo.dev/guides/using-eslint/
// File naming: all source files must use kebab-case (naming/case rule below)
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginNaming = require('eslint-plugin-naming');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    plugins: {
      naming: eslintPluginNaming,
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      eqeqeq: ['error', 'always'],
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
]);
