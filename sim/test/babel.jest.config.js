// @ts-check
/**
 * Jest Babel config for product UI simulations.
 * Compiles Lingui macros (no module mocks) and uses Expo's preset.
 */
const path = require('node:path');

module.exports = function (api) {
  api.cache(
    () => `${process.env.NODE_ENV ?? ''}:${process.env.EXPO_PUBLIC_E2E ?? ''}`
  );
  return {
    presets: [
      [
        require.resolve('expo/internal/babel-preset'),
        { enableBabelRuntime: false },
      ],
    ],
    plugins: [
      require('./babel-plugin-sim-sql-backend-jest.cjs'),
      ['@lingui/babel-plugin-lingui-macro', { stripMessageField: false }],
      // `await using` / `using` → try/finally + babelHelpers.usingCtx().
      require.resolve('@babel/plugin-transform-explicit-resource-management'),
      // some ESM packages use `await import()`; Node Jest needs require().
      require('./babel-plugin-dynamic-import-to-require.cjs'),
      // Inject dataSet.src for rntl snapshot HTML (data-src in frames).
      path.resolve(__dirname, '../../pkgs/babel-plugins/jsx-source-attr.cjs'),
    ],
  };
};
