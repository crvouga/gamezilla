/**
 * Corpus roots: dry-run every sx-bearing .ts/.tsx under the widened roots;
 * prove parseFailures=0, unstable=[], manual=0. The completeness gate is
 * asserted only for the migration corpus, not implementation internals.
 */

import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEFAULT_GLOBS } from '../cli-io';
import { runCodemod } from '../run-codemod';

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
  /<(?:Box|Clickable|Text|Stack|Center|Spacer|ScrollView|GradientBox|Island|Card|Divider|VirtualList|SpinnerBox|MenuList|FocusTrap|ExampleRoot)\b|(?:frameSx|enterSx|exitSx|fieldSx|sx)\s*=|\bSx(?:Props|Input)\b/;

describe('corpus round-trip', () => {
  test('zero parse failures; zero manuals; corpus transforms stably', async () => {
    const paths = await collectSources();
    expect(paths.length).toBeGreaterThan(100);
    const inputs: Record<string, string> = {};
    for (const path of paths) {
      const text = await readFile(path, 'utf8');
      if (!MENTIONS_SX.test(text)) continue;
      inputs[path] = text;
    }
    expect(Object.keys(inputs).length).toBeGreaterThan(100);
    let result: ReturnType<typeof runCodemod>;
    expect(() => {
      result = runCodemod(inputs, { dryRun: true });
    }).not.toThrow();
    expect(result!.summary.parseFailures).toBe(0);
    expect(result!.unstable).toEqual([]);
    expect(result!.summary.totalManual).toBe(0);
    for (const output of result!.outputs) {
      expect(output.nextText).not.toContain('TODO(sx-codemod)');
    }
    const gateKinds = new Set(result!.gateHits.map((hit) => hit.kind));
    expect(gateKinds).not.toContain('todo');
    expect(gateKinds).toBeDefined();
    process.stdout.write(
      `corpus: scanned=${paths.length} candidates=${Object.keys(inputs).length} ` +
        `A=${result!.summary.totalConvertedA} B=${result!.summary.totalConvertedB} ` +
        `gateHits=${result!.gateHits.length} manual=0\n`
    );
  }, 120000);
});
