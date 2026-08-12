// @ts-check
/**
 * Jest Babel config for product UI simulations.
 * Compiles Lingui macros (no module mocks) and uses Expo's preset.
 */
const path = require('node:path');

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
      // `await using` / `using` → try/finally + babelHelpers.usingCtx().
      require.resolve(
        '@babel/plugin-transform-explicit-resource-management'
      ),
      // better-auth (and other ESM) use `await import()`; Node Jest needs require().
      require('./babel-plugin-dynamic-import-to-require.cjs'),
      // Inject dataSet.src for in-process snapshot HTML (data-src in frames).
      path.resolve(__dirname, '../../pkgs/babel-plugins/jsx-source-attr.cjs'),
    ],
  };
};
