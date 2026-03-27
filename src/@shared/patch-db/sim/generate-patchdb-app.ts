/**
 * Runs **Vite** to emit `patchdb-app/` at the repo root (Tailwind, sql.js WASM `?url`, ES modules).
 *
 * Output: repo root `patchdb-app/`. Serve with `bun run viz:serve` or any static host.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATCHDB_APP_SRC = join(__dirname, 'patchdb-app');

async function main(): Promise<void> {
  await viteBuild({
    configFile: join(PATCHDB_APP_SRC, 'vite.config.ts'),
  });

  console.log('Wrote patchdb-app/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
