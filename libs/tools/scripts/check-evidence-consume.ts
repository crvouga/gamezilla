// @io-wall-ok — consume one downloaded archive; retain only the current job's evidence.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { archiveEntries, extractEvidence } from './check-evidence-archive';
import { evidencePaths } from './check-evidence-selection';
import { consumeReportEvidence } from './check-report-evidence';
import type { CheckPlan } from './check-shards';

const ROOT = join(import.meta.dirname, '../../..');

export async function consumeEvidence(
  archive: string,
  mode: string
): Promise<void> {
  if (!['prerequisites', 'consumers', 'verdict', 'reports'].includes(mode))
    throw new Error(`Unknown evidence consumer: ${mode}`);
  const planPath = join(ROOT, '.cache/check-ci/plan.json');
  const plan = existsSync(planPath)
    ? (JSON.parse(readFileSync(planPath, 'utf8')) as CheckPlan)
    : null;
  if (mode === 'consumers' && !plan)
    throw new Error('Consumer evidence requires the immutable plan');
  const entries = archiveEntries(archive);
  extractEvidence(archive, evidencePaths(entries, mode, plan), ROOT);
  if (mode === 'reports') await consumeReportEvidence(archive, entries, ROOT);
}
