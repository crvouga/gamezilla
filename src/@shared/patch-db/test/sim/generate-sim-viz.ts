/**
 * Reads `.sim-recordings/*.json`, bundles the TypeScript/TSX viz app with Bun,
 * and emits a self-contained `sim-viz/index.html`.
 *
 * HTML shell + app source: `sim-viz/` (bundled into a single IIFE)
 *
 * Run from repo root: `bun run src/@shared/patch-db/test/sim/generate-sim-viz.ts`
 */
import { assert } from '@/@shared/assert';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRecordingsDir, loadAllRecordings } from './recording-store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIM_VIZ_DIR = join(__dirname, 'sim-viz');
const TEMPLATE_FILE = join(SIM_VIZ_DIR, 'template.html');
const ENTRY_FILE = join(SIM_VIZ_DIR, 'entry.tsx');
const OUT_DIR = 'sim-viz';
const OUT_FILE = join(OUT_DIR, 'index.html');

function escapeForInlineScriptJson(s: string): string {
  return s
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function bundleApp(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [ENTRY_FILE],
    target: 'browser',
    format: 'iife',
    minify: false,
    jsx: {
      runtime: 'classic',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error('Bun.build failed');
  }

  const output = result.outputs[0];
  assert.defined(output, 'No output from Bun.build');
  return output.text();
}

async function main(): Promise<void> {
  const recordings = loadAllRecordings();
  const dir = getRecordingsDir();
  const template = readFileSync(TEMPLATE_FILE, 'utf-8');

  const [bundleJs, json] = await Promise.all([
    bundleApp(),
    Promise.resolve(escapeForInlineScriptJson(JSON.stringify(recordings))),
  ]);

  const html = template
    .replaceAll('__BUNDLE_JS__', bundleJs)
    .replaceAll('__RECORDINGS_JSON__', json)
    .replaceAll('__DIR_LABEL__', JSON.stringify(dir));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html, 'utf-8');
  console.log('Wrote', OUT_FILE, '(' + recordings.length + ' recordings)');
}

main();
