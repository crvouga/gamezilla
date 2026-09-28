// @io-wall-ok — reads spec-part report buckets off the wall filesystem.
/**
 * The scenario side of the `bun check` report (`libs/tools/scripts/check-report/`):
 * read one spec part's report bucket (`<pkg>/.cache/harness-report/part-<k>`,
 * written by `scripts/test-spec.ts`) into a bundle with its JUnit outcomes
 * overlaid, and fold every part's bundle into one `@pkgs/harness-report`
 * document, which the check report embeds.
 */
import {
  applyJunitOutcomes,
  type HtmlReportBundle,
  type JunitCase,
  mergeRunBundles,
  parseJunit,
  readRunBundle,
} from '@pkgs/harness';
import { renderHtmlReport } from '@pkgs/harness-report';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

export type ScenarioBundle = HtmlReportBundle;

export type ScenarioCase = JunitCase;

/**
 * One spec part, labelled with the task that produced it: every scenario's
 * outcome (the runner's JUnit — the whole truth, code tests included) and
 * the step timelines the harnesses recorded (a suite without harness
 * timelines, such as a Quint replay, has cases and no timelines).
 */
export type ScenarioRun = {
  readonly label: string;
  readonly cases: readonly ScenarioCase[];
  readonly bundle: ScenarioBundle;
};

export type ScenarioCounts = {
  passed: number;
  failed: number;
  skipped: number;
};

/** `test-spec.ts` writes every bucket as this one run. */
const BUCKET_RUN_ID = 'latest';
const JUNIT_KEY = 'junit.xml';

/** Longest failure text a case keeps; the rest is in the task log. */
const FAILURE_CHARS = 4000;

function trimFailure(c: JunitCase): JunitCase {
  return c.failure === null || c.failure.length <= FAILURE_CHARS
    ? c
    : { ...c, failure: `${c.failure.slice(0, FAILURE_CHARS)}\n…` };
}

/** The bucket at `dir`, JUnit outcomes overlaid, or null without a JUnit. */
export async function readScenarioBucket(
  dir: string
): Promise<Omit<ScenarioRun, 'label'> | null> {
  const store = createNodeFsObjectStore({
    rootDir: dir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const junit = await store.get(JUNIT_KEY);
  if (junit === null) return null;
  const xml = await new Response(junit.body).text();
  const cases = parseJunit(xml);
  const bundle = await readRunBundle(store, BUCKET_RUN_ID);
  return {
    cases: cases.map(trimFailure),
    bundle: applyJunitOutcomes(bundle, cases),
  };
}

export function scenarioCounts(runs: readonly ScenarioRun[]): ScenarioCounts {
  const counts: ScenarioCounts = { passed: 0, failed: 0, skipped: 0 };
  for (const run of runs) {
    for (const c of run.cases) counts[c.status] += 1;
  }
  return counts;
}

export type ScenarioReportOptions = {
  readonly title: string;
  /** The product stylesheet for UI frames (`HARNESS_FRAMES=1`), or empty. */
  readonly frameCss: string;
};

/**
 * One standalone scenario report over every run's step timelines, or null
 * when no run recorded any.
 */
export function renderScenarioReport(
  runs: readonly ScenarioRun[],
  options: ScenarioReportOptions
): string | null {
  const timed = runs.filter((run) => run.bundle.tests.length > 0);
  if (timed.length === 0) return null;
  return renderHtmlReport(mergeRunBundles(BUCKET_RUN_ID, timed), options);
}
