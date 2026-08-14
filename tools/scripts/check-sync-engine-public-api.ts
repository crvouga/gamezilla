#!/usr/bin/env bun
// @io-wall-ok — tools composition root

/**
 * Checked-in API report for `@pkgs/sync-engine` entrypoints.
 * Drift fails CI — update `pkgs/sync-engine/api-reports/*.txt` deliberately.
 */
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const pkg = join(root, 'pkgs/sync-engine');
const reportDir = join(pkg, 'api-reports');

const ENTRYPOINTS = ['client', 'server', 'shared', 'test'] as const;

function parseExports(source: string): string[] {
  const names = new Set<string>();
  const exportBlock =
    /export\s+(?:type\s+)?(?:\{([^}]+)\}|(?:async\s+)?(?:function|const|class|enum)\s+(\w+)|type\s+(\w+))/g;
  let match: RegExpExecArray | null;
  while ((match = exportBlock.exec(source)) !== null) {
    if (match[1] !== undefined) {
      for (const part of match[1].split(',')) {
        const cleaned = part
          .trim()
          .replace(/^type\s+/, '')
          .replace(/\s+as\s+\w+$/, '')
          .trim();
        if (cleaned.length > 0) names.add(cleaned);
      }
    }
    const single = match[2] ?? match[3];
    if (single !== undefined) names.add(single);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

const violations: string[] = [];

for (const name of ENTRYPOINTS) {
  const indexPath = join(pkg, 'src', name, 'index.ts');
  const source = await Bun.file(indexPath).text();
  const actual = `${parseExports(source).join('\n')}\n`;
  const reportPath = join(reportDir, `${name}.txt`);
  const reportFile = Bun.file(reportPath);
  if (!(await reportFile.exists())) {
    await Bun.write(reportPath, actual);
    console.log(`wrote missing api-report ${name}.txt`);
    continue;
  }
  const expected = await reportFile.text();
  if (actual !== expected) {
    violations.push(
      `${name}: public API drifted.\n--- expected (${reportPath})\n${expected}\n--- actual\n${actual}`
    );
  }
}

if (violations.length > 0) {
  console.error('ci:sync-engine-public-api FAILED:');
  for (const v of violations) console.error(v);
  process.exit(1);
}

console.log(`ci:sync-engine-public-api OK (${ENTRYPOINTS.join(', ')})`);
