// @io-wall-ok — coverage reporter composition root
import { relative, resolve } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

export type FileCoverage = {
  /** Instrumented line number → execution count (max observed across runs). */
  readonly lines: Map<number, number>;
  functionsFound: number;
  functionsHit: number;
};

export type LcovRecord = {
  /** Absolute file path (resolved against the run's cwd). */
  readonly path: string;
  readonly coverage: FileCoverage;
};

export type CoverageCounts = {
  readonly found: number;
  readonly hit: number;
};

function createFileCoverage(): FileCoverage {
  return { lines: new Map(), functionsFound: 0, functionsHit: 0 };
}

function parseNumber(text: string): number | undefined {
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Parse a bun `lcov.info`. `baseDir` is the cwd of the test run, since bun
 * emits `SF:` paths relative to it (including `../<pkg>/src/...` for
 * workspace imports).
 */
export function parseLcov(text: string, baseDir: string): LcovRecord[] {
  const records: LcovRecord[] = [];
  let current: FileCoverage | undefined;
  let currentPath = '';
  for (const line of text.split('\n')) {
    if (line === 'end_of_record') {
      if (current !== undefined && currentPath !== '') {
        records.push({
          path: resolve(baseDir, currentPath),
          coverage: current,
        });
      }
      current = undefined;
      currentPath = '';
      continue;
    }
    if (line.startsWith('SF:')) {
      current = createFileCoverage();
      currentPath = line.slice(3).trim();
      continue;
    }
    if (current === undefined) continue;
    if (line.startsWith('DA:')) {
      const [numberText, hitsText] = line.slice(3).split(',');
      const number = parseNumber(numberText ?? '');
      const hits = parseNumber(hitsText ?? '');
      if (number !== undefined && hits !== undefined) {
        current.lines.set(
          number,
          Math.max(current.lines.get(number) ?? 0, hits)
        );
      }
      continue;
    }
    if (line.startsWith('FNF:')) {
      current.functionsFound = Math.max(
        current.functionsFound,
        parseNumber(line.slice(4)) ?? 0
      );
      continue;
    }
    if (line.startsWith('FNH:')) {
      current.functionsHit = Math.max(
        current.functionsHit,
        parseNumber(line.slice(4)) ?? 0
      );
    }
  }
  return records;
}

/**
 * Fold a record into the cross-run index. Lines union by line number (covered
 * by any run wins); function totals take the best run per file, since bun's
 * lcov carries no `FN:` names to union on.
 */
export function mergeInto(
  index: Map<string, FileCoverage>,
  record: LcovRecord
): void {
  const existing = index.get(record.path);
  if (existing === undefined) {
    index.set(record.path, record.coverage);
    return;
  }
  for (const [number, hits] of record.coverage.lines) {
    existing.lines.set(number, Math.max(existing.lines.get(number) ?? 0, hits));
  }
  existing.functionsFound = Math.max(
    existing.functionsFound,
    record.coverage.functionsFound
  );
  existing.functionsHit = Math.max(
    existing.functionsHit,
    record.coverage.functionsHit
  );
}

export function countLines(coverage: FileCoverage | undefined): CoverageCounts {
  if (coverage === undefined) return { found: 0, hit: 0 };
  let hit = 0;
  for (const hits of coverage.lines.values()) {
    if (hits > 0) hit += 1;
  }
  return { found: coverage.lines.size, hit };
}

export function countFunctions(
  coverage: FileCoverage | undefined
): CoverageCounts {
  if (coverage === undefined) return { found: 0, hit: 0 };
  return { found: coverage.functionsFound, hit: coverage.functionsHit };
}

/** A file counts as reached once any instrumented line executed. */
export function isReached(coverage: FileCoverage | undefined): boolean {
  if (coverage === undefined) return false;
  for (const hits of coverage.lines.values()) {
    if (hits > 0) return true;
  }
  return false;
}

function formatHits(hits: ReadonlyMap<number, number>): string {
  const lines: string[] = [];
  for (const number of [...hits.keys()].sort((a, b) => a - b)) {
    lines.push(`DA:${String(number)},${String(hits.get(number) ?? 0)}`);
  }
  return lines.join('\n');
}

/** Serialize the index as a single lcov file with repo-relative `SF:` paths. */
export function formatLcov(
  index: ReadonlyMap<string, FileCoverage>,
  repoRoot: string
): string {
  const blocks: string[] = [];
  for (const path of [...index.keys()].sort()) {
    const coverage = index.get(path);
    if (coverage === undefined) continue;
    const lines = countLines(coverage);
    const functions = countFunctions(coverage);
    blocks.push(
      [
        'TN:',
        `SF:${slashPath(relative(repoRoot, path))}`,
        `FNF:${String(functions.found)}`,
        `FNH:${String(functions.hit)}`,
        formatHits(coverage.lines),
        `LF:${String(lines.found)}`,
        `LH:${String(lines.hit)}`,
        'end_of_record',
      ].join('\n')
    );
  }
  return `${blocks.join('\n')}\n`;
}
