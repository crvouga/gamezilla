// @io-wall-ok — the report store under `.cache/check-report/`.
/**
 * Where reports live and how one is rendered to disk.
 *
 *   .cache/check-report/<id>/index.html   the report
 *   .cache/check-report/<id>/report.json  its verdict, commit and counts
 *   .cache/check-report/latest            the id `bun check` wrote last
 *
 * `<id>` is the gate fingerprint (`model.ts`), so a rerun over the same
 * inputs rewrites the same report instead of piling up copies.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { renderScenarioReport } from '@libs/harness/scenario-report';
import { compileFrameCss } from './frame-css';
import {
  type CheckFragment,
  type CheckReport,
  countByStatus,
  type Scm,
  type Verdict,
} from './model';
import { renderCheckReport } from './render';
import { specInventory } from './spec-inventory';

export const REPORT_DIR = '.cache/check-report';
const LATEST = 'latest';

export type StoredReport = {
  readonly id: string;
  readonly verdict: Verdict;
  readonly scm: Scm | null;
  readonly origin: string | null;
  readonly counts: Readonly<Record<string, number>>;
};

export type RenderInput = {
  readonly repoRoot: string;
  readonly report: CheckReport;
  /** Compile the product CSS into the scenario frames (`HARNESS_FRAMES=1`). */
  readonly frames: boolean;
};

/** The whole standalone document for `report`. */
export function renderReportHtml(input: RenderInput): string {
  const { report } = input;
  const framed =
    input.frames && report.specRuns.some((run) => run.bundle.tests.length > 0);
  const scenarioHtml = renderScenarioReport(report.specRuns, {
    title: `scenarios · ${report.id}`,
    frameCss: framed ? compileFrameCss(input.repoRoot) : '',
  });
  return renderCheckReport(report, {
    inventory: specInventory(),
    scenarioHtml,
  });
}

/** Render `report` into the store, mark it latest; returns its HTML path. */
export function storeReport(input: RenderInput): string {
  const dir = join(input.repoRoot, REPORT_DIR, input.report.id);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'index.html');
  writeFileSync(path, renderReportHtml(input));
  const { id, verdict, scm, origin, tasks } = input.report;
  const stored: StoredReport = {
    id,
    verdict,
    scm,
    origin,
    counts: countByStatus(tasks),
  };
  writeFileSync(
    join(dir, 'report.json'),
    `${JSON.stringify(stored, null, 2)}\n`
  );
  writeFileSync(join(input.repoRoot, REPORT_DIR, LATEST), `${id}\n`);
  return path;
}

export function readStored(repoRoot: string, id: string): StoredReport | null {
  const path = join(repoRoot, REPORT_DIR, id, 'report.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as StoredReport;
}

export function latestId(repoRoot: string): string | null {
  const path = join(repoRoot, REPORT_DIR, LATEST);
  if (!existsSync(path)) return null;
  const id = readFileSync(path, 'utf8').trim();
  return id === '' ? null : id;
}

/** Every stored report. */
export function storedReports(repoRoot: string): readonly StoredReport[] {
  const root = join(repoRoot, REPORT_DIR);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readStored(repoRoot, entry.name))
    .filter((stored): stored is StoredReport => stored !== null);
}

/**
 * The stored report a reader named: `latest`, an id or id prefix, or a
 * commit sha or prefix (a commit can have several; the latest wins if it is
 * one of them).
 */
export function resolveReport(
  repoRoot: string,
  query: string
): StoredReport | null {
  const latest = latestId(repoRoot);
  if (query === LATEST) {
    return latest === null ? null : readStored(repoRoot, latest);
  }
  const matches = storedReports(repoRoot).filter(
    (r) => r.id.startsWith(query) || (r.scm?.sha.startsWith(query) ?? false)
  );
  return matches.find((r) => r.id === latest) ?? matches[0] ?? null;
}

export function reportHtmlPath(repoRoot: string, id: string): string {
  return join(repoRoot, REPORT_DIR, id, 'index.html');
}

export function writeFragment(path: string, fragment: CheckFragment): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(fragment));
}

/** Every `*.json` fragment under `dir`, recursively (artifact downloads nest). */
export function readFragments(dir: string): readonly CheckFragment[] {
  const out: CheckFragment[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readFragments(path));
    else if (entry.name.endsWith('.json')) {
      out.push(JSON.parse(readFileSync(path, 'utf8')) as CheckFragment);
    }
  }
  return out;
}
