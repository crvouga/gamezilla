// @ts-check
/**
 * Babel config for Solid `.tsx` under Bun (`register.ts`).
 * Strips TypeScript, compiles Lingui macros for the Solid JSX runtime, then
 * compiles Solid JSX to DOM expressions (`babel-preset-solid`).
 */
const path = require('node:path');
const { getConfig } = require('@lingui/conf');

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Solid-flavoured macro output (`jsxRuntime: 'solid'`), same catalogs as root. */
const linguiConfig = getConfig({
  configPath: path.resolve(REPO_ROOT, 'lingui.solid.config.ts'),
});

module.exports = function (api) {
  api.cache(
    () => `${process.env.NODE_ENV ?? ''}:${process.env.VITE_E2E ?? ''}`
  );
  return {
    presets: [
      [
        require.resolve('@babel/preset-typescript'),
        { isTSX: true, allExtensions: true, allowDeclareFields: true },
      ],
      // Browser DOM output; `hydratable` off — tests mount fresh roots.
      [require.resolve('babel-preset-solid'), { generate: 'dom' }],
    ],
    plugins: [
      // Keep `message` on descriptors so a missing key renders English.
      [
        require.resolve('@lingui/babel-plugin-lingui-macro'),
        { descriptorFields: 'all', linguiConfig },
      ],
      // `await using` / `using` → try/finally + babelHelpers.usingCtx().
      require.resolve('@babel/plugin-transform-explicit-resource-management'),
    ],
  };
};
