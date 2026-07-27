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
const path = require('node:path');

module.exports = function (api) {
  // Cache key must include NODE_ENV + EXPO_PUBLIC_E2E so the jsx-source-attr
  // gate (dev/e2e vs production strip) cannot freeze across builds.
  api.cache.using(
    () => `${process.env.NODE_ENV ?? ''}:${process.env.EXPO_PUBLIC_E2E ?? ''}`
  );
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
    plugins: [
      '@lingui/babel-plugin-lingui-macro',
      path.resolve(__dirname, '../../pkgs/babel-plugins/jsx-source-attr.cjs'),
    ],
  };
};
