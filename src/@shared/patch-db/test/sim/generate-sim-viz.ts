/**
 * Runs **Vite** to emit `sim-viz/` at the repo root (Tailwind, sql.js WASM `?url`, ES modules).
 *
 * Output: repo root `sim-viz/`. Serve with `bun run viz:serve` or any static host.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIM_VIZ_SRC = join(__dirname, 'sim-viz');

async function main(): Promise<void> {
  await viteBuild({
    configFile: join(SIM_VIZ_SRC, 'vite.config.ts'),
  });

  console.log('Wrote sim-viz/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
