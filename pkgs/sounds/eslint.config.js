const eslintPluginLingui = require('eslint-plugin-lingui');
const {
  createSharedBlocks,
} = require('../../pkgs/eslint-rules/base-config.cjs');
const { linguiRules } = require('../../pkgs/eslint-rules/lingui-rules.cjs');

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.tsx'],
    plugins: {
      lingui: eslintPluginLingui,
    },
    rules: {
      ...linguiRules(),
    },
  },
];
