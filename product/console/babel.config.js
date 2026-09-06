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
          unstable_transformImportMeta: true,
          web: {
            enableBabelRuntime: false,
            // Hermes classic scripts cannot parse `import.meta` (sqlite-wasm
            // and other ESM); polyfill as belt/suspenders.
            unstable_transformImportMeta: true,
          },
        },
      ],
    ],
    plugins: [
      // Keep `message` on descriptors in production. Lingui's default strips it
      // to shrink the bundle; missing catalog keys then render the hashed id
      // (`iDNBZe`) instead of English.
      ['@lingui/babel-plugin-lingui-macro', { descriptorFields: 'all' }],
      path.resolve(__dirname, '../../pkgs/babel-plugins/jsx-source-attr.cjs'),
    ],
  };
};
