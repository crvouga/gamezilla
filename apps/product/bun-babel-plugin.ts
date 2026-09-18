// @io-wall-ok — bun:test preload; Babel transform + module resolution for Solid
/**
 * Bun plugin for in-process Solid product tests.
 *
 * - Workspace `.tsx` → Babel (`babel.test.config.cjs`: TypeScript strip,
 *   Lingui macro for the Solid runtime, `babel-preset-solid` DOM output).
 *   Bun's native `tsx` loader emits JSX `jsx()` calls, which Solid
 *   cannot render — every JSX file must go through Babel.
 * - Solid's browser **dev** build is selected by the `--conditions=browser
 *   --conditions=development` flags on every `bun test` script (Bun's default
 *   `node` condition picks Solid's SSR build, whose `render` throws). Runtime
 *   `onResolve` cannot rewrite bare specifiers imported from `node_modules`
 *   (`@solidjs/router` → `solid-js/web`), so conditions are the only lever.
 * - `*.module.css` → proxy of class names; plain `.css` → empty module;
 *   media assets (`.mp3`, images, fonts) → their file path.
 *
 * `onLoad` is synchronous so CJS `require()` of transformed modules works.
 */

import { readFileSync } from 'node:fs';
import { plugin } from 'bun';

process.env['VITE_E2E'] = process.env['VITE_E2E'] ?? '1';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

const configFile = require.resolve('./babel.test.config.cjs');

type BabelCore = {
  transformSync: (
    code: string,
    opts: object
  ) => { code?: string | null } | null;
};

const babel = require('@babel/core') as BabelCore;

/** Workspace `.tsx` outside `node_modules` (tests included). */
const WORKSPACE_TSX_FILTER = /^(?!.*\/node_modules\/).*\.tsx$/;
const CSS_FILTER = /\.css$/;
/** Media assets (`require('../assets/x.mp3')`) → their file path, like Vite's URL import. */
const MEDIA_FILTER = /\.(?:mp3|wav|ogg|png|jpe?g|gif|webp|svg|woff2?|ttf)$/;

/**
 * Each bun `@lingui/core` copy must activate; macros compile to `i18n._`.
 * Single line, joined to the module's first line, so the inline source map's
 * line numbers stay exact (only line 1 gets a column offset).
 */
const LINGUI_ACTIVATE =
  'import { i18n as __gzLingui } from "@lingui/core"; ' +
  'if (__gzLingui.locale == null || __gzLingui.locale === "") { ' +
  '__gzLingui.loadAndActivate({ locale: "en", messages: {} }); } ';

function transformSolidTsx(
  path: string,
  source: string
): { contents: string; loader: 'js' } {
  const result = babel.transformSync(source, {
    filename: path,
    babelrc: false,
    configFile,
    sourceMaps: 'inline',
    parserOpts: {
      plugins: ['typescript', 'jsx', 'explicitResourceManagement'],
    },
  });
  const code = result?.code ?? source;
  if (!code.includes('@lingui/core')) return { contents: code, loader: 'js' };
  return { contents: `${LINGUI_ACTIVATE}${code}`, loader: 'js' };
}

function cssModule(path: string): { contents: string; loader: 'js' } {
  if (path.endsWith('.module.css')) {
    return {
      contents:
        'export default new Proxy({}, { get: (_target, key) => String(key) });',
      loader: 'js',
    };
  }
  return { contents: 'export {};', loader: 'js' };
}

plugin({
  name: 'product-test-solid',
  setup(build) {
    build.onLoad({ filter: WORKSPACE_TSX_FILTER }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      return transformSolidTsx(args.path, source);
    });
    build.onLoad({ filter: CSS_FILTER }, (args) => cssModule(args.path));
    build.onLoad({ filter: MEDIA_FILTER }, (args) => ({
      contents: `module.exports = ${JSON.stringify(args.path)};`,
      loader: 'js',
    }));
  },
});
