/**
 * Probe: show the codemod's dry-run transform for specific paths.
 * Run: bun codemod/tests/show-transform.ts <path-substring> [...]
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runCodemod } from '../run-codemod';

const ROOT = resolve(process.cwd());
const SCAN_ROOTS = ['apps/client/src', 'apps/product', 'libs', 'pkgs'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx']);

async function collect(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.turbo') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf('.'))))
        out.push(path);
    }
  }
  await walk(root);
  return out;
}

const needles = process.argv.slice(2);
const roots = SCAN_ROOTS.map((r) => join(ROOT, r));
const paths = (await Promise.all(roots.map((r) => collect(r)))).flat();
const inputs: Record<string, string> = {};
for (const path of paths) {
  inputs[path] = await readFile(path, 'utf8');
}
const result = runCodemod(inputs, { dryRun: true });
const rel = (p: string): string => p.slice(ROOT.length + 1);
let shown = 0;
for (const output of result.outputs) {
  if (!output.changed) continue;
  if (needles.length > 0 && !needles.some((n) => output.path.includes(n)))
    continue;
  shown += 1;
  process.stdout.write(`\n===== ${rel(output.path)} =====\n`);
  process.stdout.write(output.nextText);
}
process.stdout.write(`\nchanged-total=${shown}\n`);
