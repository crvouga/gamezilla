/**
 * Copies sql.js's browser WebAssembly bundle into `public/` so the web app
 * can boot a fresh in-memory SQLite per tab without OPFS coordination.
 *
 * `SqlClientImplSqlJs` configures `locateFile` to resolve relative to
 * `document.baseURI`, so the wasm needs to be served at `/sql-wasm-browser.wasm`.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const repoRoot = join(clientRoot, '..', '..');
const publicDir = join(clientRoot, 'public');

mkdirSync(publicDir, { recursive: true });

// Resolve from `packages/lib` (which declares `sql.js` as a workspace dep) so the
// content-addressed Bun install layout in the monorepo always finds it.
const require = createRequire(join(repoRoot, 'packages/lib/package.json'));
const wasmSource = require.resolve('sql.js/dist/sql-wasm-browser.wasm');
const wasmDest = join(publicDir, 'sql-wasm-browser.wasm');
copyFileSync(wasmSource, wasmDest);
console.log(`Copied ${wasmSource} → ${wasmDest}`);
