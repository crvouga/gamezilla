// @ts-check
/**
 * bun:test Babel config for product UI simulations.
 * Compiles Lingui macros (no module mocks). Skip Expo's preset: its
 * unicode-regex plugin crashes under bun:test (split `regenerate` copies).
 */
const path = require('node:path');

const expoDir = path.dirname(require.resolve('expo/internal/babel-preset'));
/** @param {string} id */
function fromExpo(id) {
  return require.resolve(id, { paths: [expoDir] });
}

module.exports = function (api) {
  const keepEsm = api.caller((caller) => caller?.keepEsm === true);
  api.cache(
    () =>
      `${process.env.NODE_ENV ?? ''}:${process.env.EXPO_PUBLIC_E2E ?? ''}:${keepEsm}`
  );
  return {
    plugins: [
      ['@lingui/babel-plugin-lingui-macro', { stripMessageField: false }],
      [
        fromExpo('@babel/plugin-transform-typescript'),
        { isTSX: true, allowNamespaces: true },
      ],
      [fromExpo('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
      // `await using` / `using` → try/finally + babelHelpers.usingCtx().
      require.resolve('@babel/plugin-transform-explicit-resource-management'),
      // some ESM packages use `await import()`; bun:test needs require().
      require('./babel-plugin-dynamic-import-to-require.cjs'),
      // Inject dataSet.src for rntl snapshot HTML (data-src in frames).
      path.resolve(__dirname, '../../pkgs/babel-plugins/jsx-source-attr.cjs'),
    ],
  };
};
