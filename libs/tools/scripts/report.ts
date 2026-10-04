import { countFunctions, countLines, isReached } from './lcov';
import type { FileCoverage } from './lcov';
import { listSourceFiles, WORKSPACE_ROOTS } from './packages';
import type { PackagePlan } from './packages';

export type PackageCoverage = {
  readonly name: string;
  readonly tier: string;
  readonly linesFound: number;
  readonly linesHit: number;
  readonly functionsFound: number;
  readonly functionsHit: number;
  readonly filesTotal: number;
  readonly filesReached: number;
};

export type CoverageSummary = {
  readonly packages: readonly PackageCoverage[];
  readonly tiers: readonly PackageCoverage[];
  readonly totals: PackageCoverage;
};

export type ReportMeta = {
  readonly secretsEnv: string;
  readonly ranPackages: number;
  /** Packages with no `bun test` segment (spec-only, …). */
  readonly skipped: readonly string[];
  /** `name (exit N)` for every package whose tests exited non-zero. */
  readonly failed: readonly string[];
  readonly durationMs: number;
  readonly artifactDir: string;
};

const WORST_MIN_LINES = 200;
const WORST_LIMIT = 10;

export function summarizePackage(
  plan: PackagePlan,
  index: ReadonlyMap<string, FileCoverage>
): PackageCoverage {
  const files = listSourceFiles(plan.dir);
  let linesFound = 0;
  let linesHit = 0;
  let functionsFound = 0;
  let functionsHit = 0;
  let filesReached = 0;
  for (const file of files) {
    const coverage = index.get(file);
    const lines = countLines(coverage);
    const functions = countFunctions(coverage);
    linesFound += lines.found;
    linesHit += lines.hit;
    functionsFound += functions.found;
    functionsHit += functions.hit;
    if (isReached(coverage)) filesReached += 1;
  }
  return {
    name: plan.name,
    tier: plan.tier,
    linesFound,
    linesHit,
    functionsFound,
    functionsHit,
    filesTotal: files.length,
    filesReached,
  };
}

function addCoverage(
  into: {
    linesFound: number;
    linesHit: number;
    functionsFound: number;
    functionsHit: number;
    filesTotal: number;
    filesReached: number;
  },
  item: PackageCoverage
): void {
  into.linesFound += item.linesFound;
  into.linesHit += item.linesHit;
  into.functionsFound += item.functionsFound;
  into.functionsHit += item.functionsHit;
  into.filesTotal += item.filesTotal;
  into.filesReached += item.filesReached;
}

export function summarize(
  plans: readonly PackagePlan[],
  index: ReadonlyMap<string, FileCoverage>
): CoverageSummary {
  const packages = plans.map((plan) => summarizePackage(plan, index));
  const zero = {
    linesFound: 0,
    linesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
    filesTotal: 0,
    filesReached: 0,
  };
  const totals = { name: 'all', tier: 'all', ...zero };
  const tiers = WORKSPACE_ROOTS.map((tier) => ({
    name: tier,
    tier,
    ...zero,
  }));
  for (const item of packages) {
    addCoverage(totals, item);
    const tier = tiers.find((candidate) => candidate.tier === item.tier);
    if (tier !== undefined) addCoverage(tier, item);
  }
  return { packages, tiers, totals };
}

export function formatPercent(hit: number, found: number): string {
  if (found === 0) return '-';
  return `${((hit / found) * 100).toFixed(1)}%`;
}

/** Thousands-separated integer, locale-independent. */
export function formatCount(value: number): string {
  const text = String(value);
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (i > 0 && (text.length - i) % 3 === 0) out += ',';
    out += text[i] ?? '';
  }
  return out;
}

export function formatDuration(durationMs: number): string {
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}m${String(Math.round(seconds % 60)).padStart(2, '0')}s`;
}

function tableRow(cells: readonly string[], widths: readonly number[]): string {
  return cells
    .map((cell, index) =>
      index === 0
        ? cell.padEnd(widths[index] ?? 0)
        : cell.padStart(widths[index] ?? 0)
    )
    .join('  ');
}

const TIER_WIDTHS = [10, 9, 9, 9];

function tierRows(summary: CoverageSummary): string[] {
  const rows = [tableRow(['tier', 'packages', 'lines', 'files'], TIER_WIDTHS)];
  const entries: Array<{ item: PackageCoverage; packages: number }> = [];
  for (const tier of summary.tiers) {
    const packages = summary.packages.filter((p) => p.tier === tier.tier);
    if (packages.length > 0) {
      entries.push({ item: tier, packages: packages.length });
    }
  }
  entries.push({ item: summary.totals, packages: summary.packages.length });
  for (const { item, packages } of entries) {
    rows.push(
      tableRow(
        [
          item.name,
          String(packages),
          formatPercent(item.linesHit, item.linesFound),
          formatPercent(item.filesReached, item.filesTotal),
        ],
        TIER_WIDTHS
      )
    );
  }
  return rows;
}

function worstRows(summary: CoverageSummary): string[] {
  const worst = summary.packages
    .filter((item) => item.linesFound >= WORST_MIN_LINES)
    .sort((a, b) => a.linesHit / a.linesFound - b.linesHit / b.linesFound)
    .slice(0, WORST_LIMIT);
  if (worst.length === 0) return [];
  const rows = [
    `worst line coverage (>= ${String(WORST_MIN_LINES)} executed lines)`,
  ];
  for (const item of worst) {
    rows.push(
      `  ${item.name.padEnd(28)} ${formatPercent(item.linesHit, item.linesFound).padStart(7)}  ${String(item.filesReached).padStart(3)}/${String(item.filesTotal).padEnd(3)} files`
    );
  }
  return rows;
}

function scopeRows(meta: ReportMeta): string[] {
  const rows = [
    '  scope     `bun test` suites only; test:contract runs as a separate check',
  ];
  if (meta.skipped.length > 0) {
    rows.push(
      `            ${String(meta.skipped.length)} packages have no \`bun test\` segment and are not measured`
    );
  }
  return rows;
}

export function renderReport(
  summary: CoverageSummary,
  meta: ReportMeta
): string[] {
  const { totals } = summary;
  const skippedNote =
    meta.skipped.length === 0
      ? ''
      : ` · ${String(meta.skipped.length)} skipped`;
  const lines: string[] = [
    `code coverage - bun test suite (SECRETS_ENV=${meta.secretsEnv})`,
    `  ${String(meta.ranPackages)} packages, ${formatDuration(meta.durationMs)}${skippedNote}`,
    '',
    `  line coverage      ${formatPercent(totals.linesHit, totals.linesFound).padStart(7)}   ${formatCount(totals.linesHit)} / ${formatCount(totals.linesFound)} lines executed`,
    `  function coverage  ${formatPercent(totals.functionsHit, totals.functionsFound).padStart(7)}   ${formatCount(totals.functionsHit)} / ${formatCount(totals.functionsFound)} functions`,
    `  file reachability  ${formatPercent(totals.filesReached, totals.filesTotal).padStart(7)}   ${formatCount(totals.filesReached)} / ${formatCount(totals.filesTotal)} src files`,
    '',
    ...tierRows(summary).map((row) => `  ${row}`),
  ];
  const worst = worstRows(summary);
  if (worst.length > 0) lines.push('', ...worst.map((row) => `  ${row}`));
  if (meta.failed.length > 0) {
    lines.push('', `  failing packages (${String(meta.failed.length)}):`);
    for (const failure of meta.failed) lines.push(`    ${failure}`);
  }
  lines.push('', ...scopeRows(meta));
  lines.push(`  artifacts  ${meta.artifactDir}/lcov.info`);
  lines.push(`             ${meta.artifactDir}/summary.json`);
  return lines;
}
