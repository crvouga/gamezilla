// @io-wall-ok — bun:test / standalone preload; Solid JSX + DOM globals.
/**
 * The IdP's screens are Solid components, and Bun's own `tsx` loader emits JSX
 * `jsx()`/`jsxDEV()` calls that Solid cannot render — so every workspace `.tsx`
 * goes through Babel (`babel-preset-solid`, DOM output) here.
 *
 * The DOM output also means the renderer needs a document wherever there is no
 * browser: happy-dom supplies it, and Bun's own globals are restored afterwards
 * so the in-process Hono app, SQLite client and fetch stay Bun's.
 *
 * `--conditions=browser --conditions=development` (set by every script that
 * preloads this file) is what makes `solid-js/web` resolve to the build whose
 * `render` works; the `node` condition selects the server build, whose `render`
 * refuses to run.
 */

import { readFileSync } from 'node:fs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { plugin } from 'bun';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

type BabelCore = {
  transformSync: (
    code: string,
    opts: object
  ) => { code?: string | null } | null;
};

const babel = require('@babel/core') as BabelCore;
const TS_PRESET = require.resolve('@babel/preset-typescript');
const SOLID_PRESET = require.resolve('babel-preset-solid');

/** Workspace `.tsx` — the IdP's own `web/` and `@pkgs/ui`'s components. */
const WORKSPACE_TSX = /^(?!.*\/node_modules\/).*\.tsx$/;
const CSS = /\.css$/;

function transformTsx(
  path: string,
  source: string
): {
  contents: string;
  loader: 'js';
} {
  const result = babel.transformSync(source, {
    filename: path,
    babelrc: false,
    configFile: false,
    sourceMaps: 'inline',
    presets: [
      [
        TS_PRESET,
        { isTSX: true, allExtensions: true, allowDeclareFields: true },
      ],
      [SOLID_PRESET, { generate: 'dom' }],
    ],
  });
  return { contents: result?.code ?? source, loader: 'js' };
}

plugin({
  name: 'idp-solid',
  setup(build) {
    build.onLoad({ filter: WORKSPACE_TSX }, (args) =>
      transformTsx(args.path, readFileSync(args.path, 'utf8'))
    );
    build.onLoad({ filter: CSS }, () => ({
      contents: 'export {};',
      loader: 'js',
    }));
  },
});

/**
 * Bun natives the in-process Hono app, SQLite client and sim HTTP rely on.
 * happy-dom emulates all of these; the Bun ones must win.
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

if (typeof document === 'undefined') {
  const saved = new Map<string, PropertyDescriptor>();
  for (const key of KEEP_BUN_GLOBALS) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor !== undefined) saved.set(key, descriptor);
  }
  GlobalRegistrator.register({
    width: 1280,
    height: 800,
    url: 'http://localhost:8080/',
  });
  for (const [key, descriptor] of saved) {
    Object.defineProperty(globalThis, key, descriptor);
  }
}
