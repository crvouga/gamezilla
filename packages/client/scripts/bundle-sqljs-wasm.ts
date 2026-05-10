/**
 * Copies sql.js's browser WebAssembly bundle into `public/generated/sql/`
 * so the web app can boot a fresh in-memory SQLite per tab without OPFS
 * coordination.
 *
 * `SqlClientImplSqlJs` configures `locateFile` to resolve this as
 * `/generated/sql/sql-wasm-browser.wasm`.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  type Stats,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const repoRoot = join(clientRoot, '..', '..');
const generatedSqlDir = join(clientRoot, 'public', 'generated', 'sql');

mkdirSync(generatedSqlDir, { recursive: true });

// Resolve from `packages/lib` (which declares `sql.js` as a workspace dep) so the
// content-addressed Bun install layout in the monorepo always finds it.
const require = createRequire(join(repoRoot, 'packages/lib/package.json'));
const wasmSource = require.resolve('sql.js/dist/sql-wasm-browser.wasm');
const wasmDest = join(generatedSqlDir, 'sql-wasm-browser.wasm');

function needsCopy(sourcePath: string, destPath: string): boolean {
  if (!existsSync(destPath)) {
    return true;
  }
  const sourceStat: Stats = statSync(sourcePath);
  const destStat: Stats = statSync(destPath);
  return (
    sourceStat.mtimeMs > destStat.mtimeMs || sourceStat.size !== destStat.size
  );
}

if (needsCopy(wasmSource, wasmDest)) {
  copyFileSync(wasmSource, wasmDest);
  console.log(`Copied ${wasmSource} -> ${wasmDest}`);
} else {
  console.log(`Up-to-date: ${wasmDest}`);
}
