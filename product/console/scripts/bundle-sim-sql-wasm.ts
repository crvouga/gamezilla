// @io-wall-ok — composition-root wall FS for Expo public WASM assets
/**
 * Copies PGlite + SQLite WASM builds into `product/console/public/generated/` so
 * the Expo web playground can load them as native ESM (import.meta.url works)
 * instead of through Metro's Hermes classic-script bundle (which cannot).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  type Stats,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';

const log = createLogger({
  name: 'sim:bundle-sim-sql-wasm',
  now: wallClock.now,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const consoleRoot = join(__dirname, '..');
const monorepoRoot = join(consoleRoot, '../..');
const sqlClientRequire = createRequire(
  join(monorepoRoot, 'pkgs/sql-client/package.json')
);

function needsCopy(sourcePath: string, destPath: string): boolean {
  if (!existsSync(destPath)) return true;
  const sourceStat: Stats = statSync(sourcePath);
  const destStat: Stats = statSync(destPath);
  return (
    sourceStat.mtimeMs > destStat.mtimeMs || sourceStat.size !== destStat.size
  );
}

function copyIfNeeded(sourcePath: string, destPath: string): void {
  mkdirSync(dirname(destPath), { recursive: true });
  if (needsCopy(sourcePath, destPath)) {
    copyFileSync(sourcePath, destPath);
    log.info(`Copied ${sourcePath} -> ${destPath}`);
  } else {
    log.info(`Up-to-date: ${destPath}`);
  }
}

const pglitePkg = dirname(
  sqlClientRequire.resolve('@electric-sql/pglite/package.json')
);
const pgliteDist = join(pglitePkg, 'dist');
const pgliteOut = join(consoleRoot, 'public', 'generated', 'pglite');
for (const name of ['pglite.wasm', 'initdb.wasm', 'pglite.data'] as const) {
  copyIfNeeded(join(pgliteDist, name), join(pgliteOut, name));
}

const sqlitePkg = dirname(
  sqlClientRequire.resolve('@sqlite.org/sqlite-wasm/package.json')
);
const sqliteDist = join(sqlitePkg, 'dist');
const sqliteOut = join(consoleRoot, 'public', 'generated', 'sqlite-wasm');
for (const name of readdirSync(sqliteDist)) {
  if (name.endsWith('.map') || name.endsWith('.d.mts')) continue;
  copyIfNeeded(join(sqliteDist, name), join(sqliteOut, name));
}
