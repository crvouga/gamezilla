// @ts-check
/**
 * Jest Babel config for product UI simulations.
 * Compiles Lingui macros (no module mocks) and uses Expo's preset.
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
      '@lingui/babel-plugin-lingui-macro',
      // better-auth (and other ESM) use `await import()`; Node Jest needs require().
      require('./babel-plugin-dynamic-import-to-require.cjs'),
    ],
  };
};
