/**
 * Round-trip on the real corpus: dry-run the codemod over every `.tsx`
 * file under the migrated tiers and prove zero parse failures.
 *
 * Also asserts the Tiger gates hold on real code: every Tier C node carries
 * its TODO marker, and tier counts are reported (coverage signal, not a
 * threshold — the counts document how much converts automatically).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { runCodemod } from '../run-codemod';

const REPO_ROOT = resolve(process.cwd(), '..', '..');
const ROOTS = ['apps/client/src', 'libs', 'pkgs/ui/src'].map((r) =>
  join(REPO_ROOT, r)
);

async function collectTsx(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.turbo') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.tsx')) out.push(full);
    }
  }
  for (const root of ROOTS) await walk(root);
  return out.sort();
}

const MENTIONS_PRIMITIVE =
  /<(Box|Clickable|Text|Stack|Center|Spacer|ScrollView|GradientBox|Island)\b|sx=\{|frameSx=\{/;

describe('corpus round-trip', () => {
  test('zero parse failures; every manual node marked; report adds up', async () => {
    const paths = await collectTsx();
    expect(paths.length).toBeGreaterThan(100);
    const inputs: Record<string, string> = {};
    for (const path of paths) {
      const text = await readFile(path, 'utf8');
      if (!MENTIONS_PRIMITIVE.test(text)) continue;
      inputs[path] = text;
    }
    expect(Object.keys(inputs).length).toBeGreaterThan(100);
    let result: ReturnType<typeof runCodemod>;
    expect(() => {
      result = runCodemod(inputs, { dryRun: true });
    }).not.toThrow();
    expect(result!.summary.parseFailures).toBe(0);
    expect(result!.unstable).toEqual([]);
    let manual = 0;
    for (const output of result!.outputs) {
      const report = result!.files.find((f) => f.path === output.path);
      manual += report?.manual.length ?? 0;
      if ((report?.manual.length ?? 0) > 0) {
        const markers = output.nextText.match(/TODO\(sx-codemod\)/g) ?? [];
        expect(markers.length).toBe(report?.manual.length ?? 0);
      }
    }
    expect(manual).toBe(result!.summary.totalManual);
    process.stdout.write(
      `corpus: scanned=${paths.length} candidates=${Object.keys(inputs).length} ` +
        `A=${result!.summary.totalConvertedA} B=${result!.summary.totalConvertedB} manual=${manual}\n`
    );
  }, 120000);
});
