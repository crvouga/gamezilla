// @io-wall-ok — composition-root wall FS for web public WASM assets
/**
 * Copies SQLite WASM builds into `product/console/public/generated/` so the
 * web playground can load them as native ESM (import.meta.url works)
 * instead of through a classic-script bundle (which cannot).
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

const sqlitePkg = dirname(
  sqlClientRequire.resolve('@sqlite.org/sqlite-wasm/package.json')
);
const sqliteDist = join(sqlitePkg, 'dist');
const sqliteOut = join(consoleRoot, 'public', 'generated', 'sqlite-wasm');
for (const name of readdirSync(sqliteDist)) {
  if (name.endsWith('.map') || name.endsWith('.d.mts')) continue;
  copyIfNeeded(join(sqliteDist, name), join(sqliteOut, name));
}
