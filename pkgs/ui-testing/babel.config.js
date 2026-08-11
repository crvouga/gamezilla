// @ts-check
/**
 * Inline Babel helpers so workspace packages transformed by Jest do not need
 * a resolvable `@babel/runtime` from every package root (Bun nested installs).
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
  };
};
