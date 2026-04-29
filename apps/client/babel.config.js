// @ts-check

// Disable `@babel/plugin-transform-runtime` on web so Babel inlines its helpers
// (e.g. `_classPrivateFieldLooseBase`) into each module instead of emitting
// `require('@babel/runtime/helpers/...')` calls. Metro's web-worker bundle does
// not include those helper modules, which caused `Requiring unknown module "2107"`
// to throw at worker load time when expo-sqlite's AccessHandlePoolVFS (which uses
// `#private` fields) ran.
//
// `require.resolve` is needed because bun's isolated node_modules layout prevents
// Babel from resolving `babel-preset-expo` by bare name from inside `@babel/core`.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        require.resolve('expo/internal/babel-preset'),
        {
          web: {
            enableBabelRuntime: false,
          },
        },
      ],
    ],
    plugins: ['@lingui/babel-plugin-lingui-macro'],
  };
};
