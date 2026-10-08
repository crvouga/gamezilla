import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import type { SpecEntry } from './explorer-types';

/** Resolve original spec paths, including runner absolute paths, without matching another document. */
export function testsForSpec(
  entry: SpecEntry,
  tests: readonly HtmlReportTest[]
): readonly HtmlReportTest[] {
  return tests.filter((test) => {
    const path = test.report.meta.sourceFile?.replaceAll('\\', '/') ?? '';
    return path === entry.path || path.endsWith(`/${entry.path}`);
  });
}

/** Build once for the inventory; large suites never scan all tests per row. */
export function specEvidenceCounts(
  tests: readonly HtmlReportTest[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const test of tests) {
    const source = test.report.meta.sourceFile?.replaceAll('\\', '/');
    if (!source) continue;
    const at = source.indexOf('specs/');
    const path = at < 0 ? source : source.slice(at);
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return counts;
}
