/**
 * Writes `sim-viz/generated/recordings.json`, bundles `sim-viz/entry.tsx` to a single
 * **classic** `bundle.js`, and copies `sim-viz/index.html` to the output folder.
 *
 * The viz HTML is opened via `file://` (`bun run viz:open`). Browsers reject `file://`
 * **module** scripts loading sibling chunks (CORS / opaque origin), so we emit one IIFE
 * and load it with `&lt;script src="./bundle.js" defer&gt;` (no `type="module"`).
 *
 * Output: repo root `sim-viz/`.
 */
import { assert } from '@/@shared/assert';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllRecordings } from './recording-store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SIM_VIZ_SRC = join(__dirname, 'sim-viz');
const OUT_DIR = join(REPO_ROOT, 'sim-viz');

async function main(): Promise<void> {
  const recordings = loadAllRecordings();

  const genDir = join(SIM_VIZ_SRC, 'generated');
  mkdirSync(genDir, { recursive: true });
  writeFileSync(
    join(genDir, 'recordings.json'),
    JSON.stringify(recordings, null, 2),
    'utf-8'
  );

  mkdirSync(OUT_DIR, { recursive: true });
  for (const name of readdirSync(OUT_DIR)) {
    if (name.endsWith('.js') || name === 'index.html') {
      rmSync(join(OUT_DIR, name));
    }
  }

  const result = await Bun.build({
    entrypoints: [join(SIM_VIZ_SRC, 'entry.tsx')],
    outdir: OUT_DIR,
    format: 'iife',
    target: 'browser',
    minify: false,
    jsx: { runtime: 'automatic' },
    /** `@/@shared/assert` → crash-expo (`react-native`); Bun cannot parse RN’s Flow entry. */
    external: ['react-native'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error('Bun.build failed');
  }

  const entryOut = result.outputs.find((o) => o.path.endsWith('.js'));
  assert.defined(entryOut, 'Bun.build: expected one .js output');

  renameSync(entryOut.path, join(OUT_DIR, 'bundle.js'));

  copyFileSync(
    join(SIM_VIZ_SRC, 'index.html'),
    join(OUT_DIR, 'index.html')
  );

  console.log('Wrote', OUT_DIR, '(' + recordings.length + ' recordings)');
}

main();
