// @io-wall-ok — build script entry
/**
 * Emits the SQLite web assets an app serves out of its `publicDir`:
 *
 *   `sql-workers/`           shared db host worker, dedicated sqlite-wasm
 *                            worker, and the disposable sql-host iframe
 *   `generated/sqlite-wasm/` the `@sqlite.org/sqlite-wasm` dist, loaded as
 *                            *native* ESM (`import.meta.url` must work, so it
 *                            cannot go through the app bundle)
 *
 * Exposed as a Vite plugin so `vite` is the only thing an app has to run: no
 * pre-dev shell chain, no cross-package `bun run --filter`, and each app emits
 * into its own `publicDir` instead of this package writing into `apps/*`.
 * Both `vite` and `vite build` resolve their config first, which is when the
 * assets are emitted, so dev and prod stay in sync.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import * as esbuild from 'esbuild';
import type { Plugin } from 'vite';

/** Bundled with esbuild (not Vite): these are separate worker entry graphs. */
const WORKER_BUNDLES = [
  { entry: 'db-host-shared-worker.ts', out: 'db-host-shared-worker.js' },
  { entry: 'sqlite-worker-entry.ts', out: 'sqlite-worker.js' },
  { entry: 'sql-host-entry.ts', out: 'sql-host.js' },
] as const;

/** Copied verbatim beside the bundles. */
const WORKER_COPIES = [
  { from: 'sql-host.html', out: 'sql-host.html' },
] as const;

/** Stale expo-sqlite-era artifacts the OPFS SAH-pool build no longer emits. */
const STALE_WORKER_FILES = [
  'sqlite-worker-entry.js',
  'worker',
  'worker.js',
  'wa-sqlite.wasm',
];

export type SqlWorkersOptions = {
  /** Monorepo root. Worker sources live at `pkgs/sql-client-sqlite-web-client/src`. */
  repoRoot: string;
  /** Directory the worker assets are emitted into. */
  outDir: string;
  /** Emit even when the outputs are newer than every source. */
  force?: boolean;
};

export type SqliteWasmOptions = {
  repoRoot: string;
  /** Directory the `@sqlite.org/sqlite-wasm` dist is copied into. */
  outDir: string;
};

const CLIENT_PACKAGE = '@pkgs/sql-client-sqlite-web-client';
const PKG_DIR = CLIENT_PACKAGE.slice(1);

function pkgSrc(repoRoot: string): string {
  return join(repoRoot, PKG_DIR, 'src');
}

/**
 * Anchored at this package, which is what declares `@sqlite.org/sqlite-wasm`:
 * bun installs workspace deps per package, so it is not resolvable from the
 * repo root or from an app that does not depend on it.
 */
function requirePkg(repoRoot: string): NodeJS.Require {
  return createRequire(join(repoRoot, PKG_DIR, 'package.json'));
}

function mtimeOrZero(path: string): number {
  return existsSync(path) ? statSync(path).mtimeMs : 0;
}

/** Newest mtime of every `.ts`/`.html` file under `dir`, recursively. */
function newestSourceMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestSourceMtime(path));
      continue;
    }
    if (!path.endsWith('.ts') && !path.endsWith('.html')) continue;
    newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

function outputsAreFresh(outDir: string, sourceMtime: number): boolean {
  const outputs = [
    ...WORKER_BUNDLES.map((b) => b.out),
    ...WORKER_COPIES.map((c) => c.out),
    'sqlite3.wasm',
  ];
  return outputs.every((name) => mtimeOrZero(join(outDir, name)) > sourceMtime);
}

/**
 * Builds the `sql-workers/` assets. Returns the number of files written, or 0
 * when everything was already newer than the newest source file.
 */
export async function buildSqlWorkers(
  options: SqlWorkersOptions
): Promise<number> {
  const { repoRoot, outDir, force = false } = options;
  const src = pkgSrc(repoRoot);
  if (!force && outputsAreFresh(outDir, newestSourceMtime(src))) return 0;

  mkdirSync(outDir, { recursive: true });
  for (const stale of STALE_WORKER_FILES) {
    rmSync(join(outDir, stale), { force: true, recursive: true });
  }

  await Promise.all(
    WORKER_BUNDLES.map((bundle) =>
      esbuild.build({
        entryPoints: [join(src, bundle.entry)],
        outfile: join(outDir, bundle.out),
        bundle: true,
        platform: 'browser',
        target: ['es2022'],
        format: 'esm',
        logLevel: 'silent',
      })
    )
  );

  for (const copy of WORKER_COPIES) {
    copyFileSync(join(src, copy.from), join(outDir, copy.out));
  }

  // `@sqlite.org/sqlite-wasm` resolves `new URL('sqlite3.wasm', import.meta.url)`
  // at runtime, so the wasm has to sit beside the worker bundle.
  copyFileSync(
    requirePkg(repoRoot).resolve('@sqlite.org/sqlite-wasm/sqlite3.wasm'),
    join(outDir, 'sqlite3.wasm')
  );

  return WORKER_BUNDLES.length + WORKER_COPIES.length + 1;
}

/**
 * Copies the `@sqlite.org/sqlite-wasm` dist into `outDir`. Returns the number
 * of files written, skipping any whose size and mtime already match.
 */
export function copySqliteWasmDist(options: SqliteWasmOptions): number {
  const { repoRoot, outDir } = options;
  const dist = join(
    dirname(
      requirePkg(repoRoot).resolve('@sqlite.org/sqlite-wasm/package.json')
    ),
    'dist'
  );
  mkdirSync(outDir, { recursive: true });

  let written = 0;
  for (const name of readdirSync(dist)) {
    if (name.endsWith('.map') || name.endsWith('.d.mts')) continue;
    const from = join(dist, name);
    const to = join(outDir, name);
    const source = statSync(from);
    if (
      existsSync(to) &&
      statSync(to).mtimeMs >= source.mtimeMs &&
      statSync(to).size === source.size
    ) {
      continue;
    }
    copyFileSync(from, to);
    written += 1;
  }
  return written;
}

export type SqliteWebAssetsOptions = {
  /** Monorepo root, as already computed by the app's Vite config. */
  repoRoot: string;
  /** Emitted under the app's `publicDir`, e.g. `public/sql-workers`. */
  sqlWorkersDir: string;
  /**
   * Emitted under the app's `publicDir`, e.g. `public/generated/sqlite-wasm`.
   * Only needed by apps that load sqlite-wasm directly (the harness); omit
   * to skip the copy entirely.
   */
  sqliteWasmDir?: string;
};

/** Vite plugin wrapper: emits the assets on `vite` and on `vite build`. */
export function sqliteWebAssets(options: SqliteWebAssetsOptions): Plugin {
  const { repoRoot, sqlWorkersDir, sqliteWasmDir } = options;
  const generatedDirs = [sqlWorkersDir, sqliteWasmDir].filter(
    (dir): dir is string => dir !== undefined
  );

  /** What was written, as `count → directory`; empty once assets are fresh. */
  const emit = async (): Promise<readonly string[]> => {
    const emitted: string[] = [];
    const workers = await buildSqlWorkers({ repoRoot, outDir: sqlWorkersDir });
    if (workers > 0) {
      emitted.push(`${workers} → ${relative(repoRoot, sqlWorkersDir)}`);
    }
    if (sqliteWasmDir !== undefined) {
      const wasm = copySqliteWasmDist({ repoRoot, outDir: sqliteWasmDir });
      if (wasm > 0) {
        emitted.push(`${wasm} → ${relative(repoRoot, sqliteWasmDir)}`);
      }
    }
    return emitted;
  };

  return {
    name: 'sqlite-web-assets',

    config() {
      // These live under `publicDir`, so writing them would otherwise make
      // the dev server full-reload the page it just served.
      return {
        server: { watch: { ignored: generatedDirs.map((dir) => `${dir}/**`) } },
      };
    },

    // Not `buildStart`: the dev server lists `publicDir` once, as it starts,
    // and serves only what it listed (the watcher above never tells it about
    // these). Assets written any later answer with `index.html`, the SQLite
    // worker never starts, and the app falls back to an in-memory database
    // on the main thread. Vite awaits this hook before it lists anything.
    async configResolved(config) {
      const emitted = await emit();
      // Silence is the steady state: nothing is logged once assets are fresh.
      if (emitted.length > 0) {
        config.logger.info(`sqlite-web assets: ${emitted.join(', ')}`, {
          timestamp: true,
        });
      }
    },
  };
}
