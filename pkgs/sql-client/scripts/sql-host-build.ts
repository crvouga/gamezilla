// @io-wall-ok — build script helper

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
export const pkgRoot = join(here, '..');

const require = createRequire(import.meta.url);

/** Root of the resolved expo-sqlite install (its `web/` tree is TS source). */
export const expoSqliteRoot = dirname(
  require.resolve('expo-sqlite/package.json')
);

export const sqlHostDir = join(pkgRoot, 'src/sqlite/web/sql-host');
export const sqlHostEntry = join(sqlHostDir, 'sql-host-entry.ts');
export const sqlHostHtml = join(sqlHostDir, 'sql-host.html');
export const expoSqliteWorkerEntry = join(expoSqliteRoot, 'web/worker.ts');

/** Served directory both bundles assume; wasm + worker resolve against it. */
export const SQL_WORKERS_PUBLIC_PATH = '/sql-workers';

/**
 * Web-only resolution for the expo-sqlite graph:
 * - `.web.*` first so `ExpoSQLite.web.js` wins over the native module.
 * - `react-native` / `expo` swapped for local shims (no RN or expo runtime).
 * - `expo-sqlite` pinned at `SQLiteDatabase` so `hooks` (React, expo-asset)
 *   never enters the bundle.
 */
export function sqlHostSharedOptions(): esbuild.BuildOptions {
  return {
    bundle: true,
    platform: 'browser',
    target: ['es2022'],
    define: { __DEV__: 'false' },
    resolveExtensions: [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '.json',
    ],
    alias: {
      'react-native': join(sqlHostDir, 'shims/react-native.ts'),
      'expo/devtools': join(sqlHostDir, 'shims/expo-devtools.ts'),
      expo: join(sqlHostDir, 'shims/expo.ts'),
      'expo-sqlite': join(expoSqliteRoot, 'build/SQLiteDatabase.js'),
    },
    logLevel: 'info',
  };
}
