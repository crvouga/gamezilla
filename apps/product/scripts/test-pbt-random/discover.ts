import { join } from 'node:path';

const TEST_GLOB = new Bun.Glob('**/*.test.{ts,tsx}');

/** Heuristic: property tests import fast-check / assertProperty. */
const PBT_MARKERS = [
  "from 'fast-check'",
  'from "fast-check"',
  "from '@pkgs/property'",
  'from "@pkgs/property"',
  'assertProperty(',
] as const;

export async function discoverPbtTests(repoRoot: string): Promise<string[]> {
  const files: string[] = [];
  for (const base of ['pkgs', 'libs'] as const) {
    for await (const rel of TEST_GLOB.scan({
      cwd: join(repoRoot, base),
      onlyFiles: true,
    })) {
      // Skip contract/e2e-shaped paths; PBT lives in unit/scenario suites.
      if (rel.includes('/e2e/') || /\.contract\.test\.tsx?$/.test(rel)) {
        continue;
      }
      const abs = join(repoRoot, base, rel);
      const text = await Bun.file(abs).text();
      if (PBT_MARKERS.some((m) => text.includes(m))) {
        files.push(join(base, rel));
      }
    }
  }
  return files.sort();
}
