// @io-wall-ok — Bun preload; Babel transform for Solid + happy-dom globals
/**
 * Runs Solid `.tsx` inside Bun, with no browser: `bun --preload` it before any
 * process that renders Solid (the IdP dev server, the localhost stack) or
 * through `./preload` for `bun test`.
 *
 * - Workspace `.tsx` → Babel (`babel.config.cjs`: TypeScript strip, Lingui
 *   macro for the Solid runtime, `babel-preset-solid` DOM output). Bun's own
 *   `tsx` loader emits JSX `jsx()` calls, which Solid cannot render.
 * - Solid's browser **dev** build is selected by the `--conditions=browser
 *   --conditions=development` flags every caller passes (Bun's default `node`
 *   condition picks Solid's SSR build, whose `render` throws). Runtime
 *   `onResolve` cannot rewrite bare specifiers imported from `node_modules`,
 *   so conditions are the only lever.
 * - `*.module.css` → isolated class names; plain `.css` → empty module;
 *   media assets (`.mp3`, images, fonts) → their file path.
 * - happy-dom supplies `document`/`window`; Bun's own fetch / streams / timers
 *   / crypto are restored afterwards so in-process Hono, SQLite and harness HTTP
 *   stay Bun's.
 *
 * `onLoad` is synchronous so CJS `require()` of transformed modules works.
 */

import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { threadId } from 'node:worker_threads';
import type * as Babel from '@babel/core';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { plugin } from 'bun';
import { publishCacheFile } from './cache-file';
import { compileCssModule } from './css-module';
import { rememberNativeEvent } from './native-event';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

const configFile = require.resolve('./babel.config.cjs');

/** Workspace `.tsx` outside `node_modules` (tests included). */
const WORKSPACE_TSX_FILTER = /^(?!.*[\\/]node_modules[\\/]).*\.tsx$/;
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

/**
 * Babel output keyed by source + config, shared across processes and
 * `--parallel` workers. Babel dominates cold start; the key covers every input
 * (`babel.config.cjs` caches on `NODE_ENV` / `VITE_TEST_HOOKS`), so a stale hit is
 * impossible and the directory is safe to delete at any time.
 */
const CACHE_DIR = join(
  import.meta.dirname,
  '../node_modules/.cache/bun-test-solid'
);
const TRANSFORM_PACKAGES = [
  '@babel/core',
  '@babel/preset-typescript',
  '@babel/plugin-transform-explicit-resource-management',
  '@lingui/babel-plugin-lingui-macro',
  'babel-preset-solid',
] as const;
const CACHE_SALT = [
  readFileSync(configFile, 'utf8'),
  readFileSync(import.meta.filename, 'utf8'),
  readFileSync(
    join(import.meta.dirname, '../../../lingui.solid.config.ts'),
    'utf8'
  ),
  ...TRANSFORM_PACKAGES.map((name) =>
    readFileSync(require.resolve(`${name}/package.json`), 'utf8')
  ),
  process.env.NODE_ENV ?? '',
  process.env['VITE_TEST_HOOKS'] ?? '',
].join('\0');

function cachedTransform(path: string, source: string): string {
  const key = Bun.hash(`${CACHE_SALT}\0${path}\0${source}`).toString(36);
  const file = join(CACHE_DIR, `${key}.js`);
  try {
    return readFileSync(file, 'utf8');
  } catch {
    const code = transformSolidTsx(path, source);
    mkdirSync(CACHE_DIR, { recursive: true });
    // Write-then-rename so a concurrent worker never reads a partial file.
    publishCacheFile(
      { writeFileSync, renameSync, rmSync },
      file,
      `${file}.${process.pid}.${threadId}.tmp`,
      code
    );
    return code;
  }
}

/**
 * Babel loads only on a cache miss: requiring `@babel/core` and its plugins is
 * most of this preload's cold start, and a warm cache never needs it.
 */
function transformSolidTsx(path: string, source: string): string {
  // oxlint-disable-next-line typescript/no-require-imports -- `onLoad` is synchronous, so a lazy load cannot be `await import()`.
  const { transformSync } = require('@babel/core') as typeof Babel;
  const result = transformSync(source, {
    filename: path,
    babelrc: false,
    configFile,
    sourceMaps: 'inline',
    parserOpts: {
      plugins: ['typescript', 'jsx', 'explicitResourceManagement'],
    },
  });
  const code = result?.code ?? source;
  return code.includes('@lingui/core') ? `${LINGUI_ACTIVATE}${code}` : code;
}

function cssModule(path: string): { contents: string; loader: 'js' } {
  if (path.endsWith('.module.css')) {
    return {
      contents: `export default ${JSON.stringify(compileCssModule(path, readFileSync(path, 'utf8')).classes)};`,
      loader: 'js',
    };
  }
  return { contents: 'export {};', loader: 'js' };
}

const WORKSPACE_IMPORT = /^@(libs|pkgs)\//;

/** Keep Bun's public export rules when isolated realms load plugin-transformed TSX. */
export function createWorkspaceResolver(
  resolve: (specifier: string, directory: string) => string
): (args: { path: string; importer: string }) => { path: string } | undefined {
  let resolving = false;
  return (args) => {
    if (!WORKSPACE_IMPORT.test(args.path) || resolving) return;
    resolving = true;
    try {
      // Bun.resolveSync re-enters runtime onResolve hooks synchronously. Let
      // that inner call use Bun's native resolver rather than recurse forever.
      return { path: resolve(args.path, dirname(args.importer)) };
    } finally {
      resolving = false;
    }
  };
}

plugin({
  name: 'bun-test-solid',
  setup(build) {
    // Isolated test realms can miss a wildcard export's TSX fallback when
    // linking plugin output. Resolve through Bun in the registered host realm;
    // this retains native export checks and leaves third-party imports alone.
    build.onResolve(
      { filter: WORKSPACE_IMPORT },
      createWorkspaceResolver((specifier, directory) =>
        Bun.resolveSync(specifier, directory)
      )
    );
    build.onLoad({ filter: WORKSPACE_TSX_FILTER }, (args) => ({
      contents: cachedTransform(args.path, readFileSync(args.path, 'utf8')),
      loader: 'js',
    }));
    build.onLoad({ filter: CSS_FILTER }, (args) => cssModule(args.path));
    build.onLoad({ filter: MEDIA_FILTER }, (args) => ({
      contents: `module.exports = ${JSON.stringify(args.path)};`,
      loader: 'js',
    }));
  },
});

/**
 * Bun natives that must survive happy-dom's global registration: in-process
 * Hono servers, SQLite clients, harness HTTP serialization and the harness schedulers
 * rely on Bun's fetch / streams / timers / crypto, not happy-dom's emulations.
 */
const KEEP_BUN_GLOBALS = [
  'fetch',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'Blob',
  'File',
  'URL',
  'URLSearchParams',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'queueMicrotask',
  'structuredClone',
  'crypto',
  'performance',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
  'WebSocket',
  'atob',
  'btoa',
] as const;

/** Desktop viewport; {@link setDomWindow} narrows it (e.g. a phone). */
const DEFAULT_WINDOW = { width: 1024, height: 768 };

type HappyDomHandle = {
  readonly happyDOM: {
    setViewport(viewport: { width: number; height: number }): void;
    setURL(url: string): void;
  };
};

/** Resize (and optionally re-address) the registered happy-dom window. */
export function setDomWindow(options: {
  readonly width: number;
  readonly height: number;
  readonly url?: string;
}): void {
  const { happyDOM } = window as unknown as HappyDomHandle;
  happyDOM.setViewport({ width: options.width, height: options.height });
  if (options.url !== undefined) happyDOM.setURL(options.url);
}

/** Release the in-process DOM's pending tasks at a process composition boundary. */
export async function disposeDomWindow(): Promise<void> {
  await GlobalRegistrator.unregister();
}

if (typeof document === 'undefined') {
  const saved = new Map<string, PropertyDescriptor>();
  // In a Bun Worker these globals belong to its parent channel. Replacing
  // them with Window methods would silently disconnect the application realm.
  const preserveDispatch = typeof globalThis.postMessage === 'function';
  const nativeEvent = globalThis.Event;
  const workerGlobals = preserveDispatch
    ? [
        'postMessage',
        'addEventListener',
        'removeEventListener',
        'dispatchEvent',
        'onmessage',
        'onmessageerror',
      ]
    : [];
  for (const key of [...KEEP_BUN_GLOBALS, ...workerGlobals]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor !== undefined) saved.set(key, descriptor);
  }
  GlobalRegistrator.register({
    ...DEFAULT_WINDOW,
    url: 'http://localhost:3000/',
  });
  for (const [key, descriptor] of saved) {
    Object.defineProperty(globalThis, key, descriptor);
  }
  // `Event` stays happy-dom's so element dispatch still works. The preserved
  // worker dispatchEvent only accepts the constructor from before registration.
  if (preserveDispatch) rememberNativeEvent(nativeEvent);
}

if (typeof Symbol.dispose !== 'symbol') {
  Object.defineProperty(Symbol, 'dispose', {
    value: Symbol.for('Symbol.dispose'),
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
if (typeof Symbol.asyncDispose !== 'symbol') {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol.for('Symbol.asyncDispose'),
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
