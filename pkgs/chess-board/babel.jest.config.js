/**
 * Jest Babel config for @pkgs/chess-board black-box UI tests.
 * Compiles Lingui macros and rewrites dynamic import() for Node Jest.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        require.resolve('expo/internal/babel-preset'),
        { enableBabelRuntime: false },
      ],
    ],
    plugins: [
      ['@lingui/babel-plugin-lingui-macro', { stripMessageField: false }],
      require('./babel-plugin-dynamic-import-to-require.cjs'),
    ],
  };
};
