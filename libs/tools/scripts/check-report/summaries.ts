// @io-wall-ok — lists and reads turbo's `--summarize` run summaries.
/**
 * Which run summary is this run's: list `.turbo/runs/` before turbo starts,
 * take what is new after. No clock involved, and a run that wrote no summary
 * (turbo crashed or was killed) is told apart from an earlier run's.
 *
 * Kept free of the report's heavier imports: `turbo-ci-run` loads it on
 * every run.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SummaryTask } from './model';

const RUNS_DIR = '.turbo/runs';

/** Names of the run summaries on disk, to tell this run's apart afterwards. */
export function runSummaryNames(repoRoot: string): ReadonlySet<string> {
  const dir = join(repoRoot, RUNS_DIR);
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((name) => name.endsWith('.json')));
}

/**
 * The tasks of the summary turbo wrote after `before` was listed, or null
 * when it wrote none. Run ids are KSUIDs, so the newest sorts last.
 */
export function readNewRunSummary(
  repoRoot: string,
  before: ReadonlySet<string>
): readonly SummaryTask[] | null {
  const fresh = [...runSummaryNames(repoRoot)].filter((n) => !before.has(n));
  const name = fresh.sort().at(-1);
  if (name === undefined) return null;
  try {
    const summary = JSON.parse(
      readFileSync(join(repoRoot, RUNS_DIR, name), 'utf8')
    ) as { readonly tasks?: readonly SummaryTask[] };
    return summary.tasks ?? null;
  } catch {
    return null;
  }
}
