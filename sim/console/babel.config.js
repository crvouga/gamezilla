// @ts-check

const path = require('node:path');

module.exports = function (api) {
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
            // Hermes classic scripts cannot parse `import.meta` (PGlite CJS
            // still pulls chunks that may retain it; polyfill as belt/suspenders).
            unstable_transformImportMeta: true,
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
