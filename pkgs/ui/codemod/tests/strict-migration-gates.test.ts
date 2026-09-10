/** Strict repository gates for the Tailwind migration command. */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { stripComments } from '../completeness-gate';
import { runCodemod } from '../run-codemod';

const ROOT = resolve(process.cwd(), '..', '..');
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

async function repositorySources(): Promise<Record<string, string>> {
  const paths = (
    await Promise.all(SCAN_ROOTS.map((root) => collect(join(ROOT, root))))
  ).flat();
  const entries = await Promise.all(
    paths.map(async (path) => [path, await readFile(path, 'utf8')] as const)
  );
  return Object.fromEntries(entries);
}

describe('strict migration gates', () => {
  test('every changed source file is parseable, stable, and fully migrated', async () => {
    const inputs = await repositorySources();
    const result = runCodemod(inputs, { dryRun: true });
    expect(Object.keys(inputs).length).toBeGreaterThan(1000);
    expect(result.summary.parseFailures).toBe(0);
    expect(result.unstable).toEqual([]);
    expect(result.outputs).toHaveLength(Object.keys(inputs).length);
    for (const output of result.outputs) {
      if (!output.changed) continue;
      // The fixture source has already been migrated, so a `changed` output is
      // the codemod re-touching it. Assert on live code only — JSDoc examples
      // legitimately mention `<Text …>`.
      const code = stripComments(output.nextText);
      expect(code).not.toContain('TODO(sx-codemod)');
      expect(code).not.toMatch(/<Text\b/);
      const jsxAttrs = code.match(/<[A-Za-z][^>]*>/g) ?? [];
      const forbiddenAttrs = jsxAttrs.filter((tag) =>
        /\b(?:sx|frameSx|fieldSx|enterSx|exitSx)\s*=/.test(tag)
      );
      expect(forbiddenAttrs, output.path).toEqual([]);
      expect(code).not.toMatch(/\bSx(?:Input|Props)\b/);
    }
  }, 120000);

  test('report accounting is exact for every file', async () => {
    const inputs = await repositorySources();
    const result = runCodemod(inputs, { dryRun: true });
    expect(result.files).toHaveLength(Object.keys(inputs).length);
    expect(result.outputs.map((output) => output.path)).toEqual(
      result.files.map((file) => file.path)
    );
    const converted = result.files.reduce(
      (sum, file) => sum + file.convertedA + file.convertedB,
      0
    );
    expect(converted).toBe(
      result.summary.totalConvertedA + result.summary.totalConvertedB
    );
    expect(result.summary.totalManual).toBe(0);
  }, 120000);
});
