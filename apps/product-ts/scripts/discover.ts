import { join, sep } from 'node:path';

const TEST_GLOB = new Bun.Glob('**/*.test.{ts,tsx}');

/** Heuristic: property tests import fast-check / assertProperty. */
const PBT_MARKERS = [
  "from 'fast-check'",
  'from "fast-check"',
  "from '@pkgs/property-shared-ts'",
  'from "@pkgs/property-shared-ts"',
  'assertProperty(',
] as const;

export async function discoverPbtTests(repoRoot: string): Promise<string[]> {
  const files: string[] = [];
  for (const base of ['pkgs', 'libs'] as const) {
    for await (const scanned of TEST_GLOB.scan({
      cwd: join(repoRoot, base),
      onlyFiles: true,
    })) {
      // Scans yield native separators; selections are repo-relative POSIX.
      const rel = scanned.split(sep).join('/');
      // Skip harness and contract paths; PBT lives in unit/scenario suites.
      if (
        rel.includes('/tests/harness/') ||
        /\.contract\.test\.tsx?$/.test(rel)
      ) {
        continue;
      }
      const abs = join(repoRoot, base, rel);
      const text = await Bun.file(abs).text();
      if (PBT_MARKERS.some((m) => text.includes(m))) {
        files.push(`${base}/${rel}`);
      }
    }
  }
  return files.sort();
}
