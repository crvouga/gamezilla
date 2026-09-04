/**
 * Babel config for @pkgs/ui-testing RNTL bun:test.
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
  };
};
