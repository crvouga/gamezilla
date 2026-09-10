/**
 * Gate probe (test-side helper): runs runCodemod over the widened corpus and
 * prints per-line gate leftovers from transformed outputs.
 * Run: bun codemod/tests/gate-probe.ts (from pkgs/ui)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { checkCompleteness } from '../completeness-gate';
import { DEFAULT_GLOBS } from '../cli-io';
import { runCodemod } from '../run-codemod';
import { transformFile } from '../transform';

const REPO_ROOT = resolve(process.cwd(), '..', '..');
const ROOTS = DEFAULT_GLOBS.map((r) => join(REPO_ROOT, r));

async function collectSources(): Promise<string[]> {
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
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (
        (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
        !entry.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
  }
  for (const root of ROOTS) await walk(root);
  return out.sort();
}

const MENTIONS_SX =
  /<(?:Box|Clickable|Text|Stack|Center|Spacer|ScrollView|GradientBox|Island|Card|Divider|Motion|VirtualList|SpinnerBox|MenuList|FocusTrap|ExampleRoot)\b|(?:frameSx|enterSx|exitSx|fieldSx|sx)\s*=|\bSx(?:Props|Input)\b/;

const paths = await collectSources();
const inputs: Record<string, string> = {};
for (const path of paths) {
  const text = await readFile(path, 'utf8');
  if (!MENTIONS_SX.test(text)) continue;
  inputs[path] = text;
}
const result = runCodemod(inputs, { dryRun: true });
process.stdout.write(
  `files=${paths.length} candidates=${Object.keys(inputs).length} ` +
    `A=${result.summary.totalConvertedA} B=${result.summary.totalConvertedB} ` +
    `parseFailures=${result.summary.parseFailures} unstable=${result.unstable.length} ` +
    `gateHits=${result.gateHits.length}\n`
);
const rel = (p: string): string => p.slice(REPO_ROOT.length + 1);
for (const u of result.unstable) process.stdout.write(`UNSTABLE ${rel(u)}\n`);
for (const f of result.files) {
  if (f.parseError !== undefined) {
    process.stdout.write(`PARSE ${rel(f.path)} :: ${f.parseError}\n`);
  }
}

const FILTER = process.argv[2];
const PATTERNS: Readonly<Record<string, RegExp>> = {
  'sx-attr': /\b(?:sx|frameSx|fieldSx|enterSx|exitSx)\s*=/,
  'purged-tag': /<(?:Box|Stack|Center|Spacer|Card|Divider|Clickable|Text)\b/,
  'sx-type': /\b(?:SxInput|SxProps|flattenSx|sxToCss)\b|tokens\.css\s*\(/,
  'class-helper': /\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass)\s*\(/,
};

for (const { path, nextText } of result.outputs) {
  const hits = checkCompleteness([{ path, nextText }]);
  if (hits.length === 0) continue;
  const kinds = new Set(hits.map((h) => h.kind));
  if (FILTER !== undefined && !kinds.has(FILTER)) continue;
  const lines = nextText.split('\n');
  const shown: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const t = line.trim();
    for (const [kind, re] of Object.entries(PATTERNS)) {
      if (!kinds.has(kind)) continue;
      if (!re.test(line)) continue;
      if (kind === 'sx-attr' && /(?:sx|frameSx|fieldSx|enterSx|exitSx)\?:/.test(line)) {
        continue;
      }
      shown.push(`${kind} L${i + 1}: ${t.slice(0, 150)}`);
    }
  }
  process.stdout.write(`\n== ${rel(path)} (${hits.map((h) => h.kind).join(',')})\n`);
  for (const s of shown.slice(0, 12)) process.stdout.write(`  ${s}\n`);
  if (shown.length > 12) process.stdout.write(`  … +${shown.length - 12} more\n`);
}