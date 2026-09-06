/**
 * bun:test Babel config for @pkgs/chess-board black-box UI tests.
 * Compiles Lingui macros and rewrites dynamic import() for CJS.
 */
module.exports = function (api) {
  const keepEsm = api.caller((caller) => caller?.keepEsm === true);
  api.cache.using(() => String(keepEsm));
  return {
    presets: [
      [
        require.resolve('expo/internal/babel-preset'),
        {
          enableBabelRuntime: false,
          disableImportExportTransform: keepEsm,
        },
      ],
    ],
    plugins: [
      ['@lingui/babel-plugin-lingui-macro', { descriptorFields: 'all' }],
      require('./babel-plugin-dynamic-import-to-require.cjs'),
    ],
  };
};
