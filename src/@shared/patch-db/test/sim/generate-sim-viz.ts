/**
 * Reads `.sim-recordings/*.json` and emits a self-contained sim visualization at `sim-viz/index.html`.
 * HTML shell + client app live in `sim-viz.template.html` (IDE-friendly); this script fills GEN_VIZ_SLOTS.
 * Run from repo root: `bun run src/@shared/patch-db/test/sim/generate-sim-viz.ts`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRecordingsDir, loadAllRecordings } from './recording-store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FILE = join(__dirname, 'sim-viz.template.html');
const OUT_DIR = 'sim-viz';
const OUT_FILE = join(OUT_DIR, 'index.html');

function escapeForInlineScriptJson(s: string): string {
  return s.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function main(): void {
  const recordings = loadAllRecordings();
  const dir = getRecordingsDir();
  const template = readFileSync(TEMPLATE_FILE, 'utf-8');
  const json = escapeForInlineScriptJson(JSON.stringify(recordings));
  const html = template
    .replaceAll('__RECORDINGS_JSON__', json)
    .replaceAll('__DIR_LABEL__', JSON.stringify(dir));
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html, 'utf-8');
  console.log('Wrote', OUT_FILE, '(' + recordings.length + ' recordings)');
}

main();
