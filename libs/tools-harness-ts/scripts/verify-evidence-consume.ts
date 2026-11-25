// @io-wall-ok — consume one downloaded archive; retain only the current job's evidence.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { archiveEntries, extractEvidence } from './verify-evidence-archive';
import { evidencePaths } from './verify-evidence-selection';
import type { VerifyPlan } from './verify-shards';

const ROOT = join(import.meta.dirname, '../../..');

export function consumeEvidence(archive: string, mode: string): void {
  if (!['prerequisites', 'consumers', 'verdict'].includes(mode))
    throw new Error(`Unknown evidence consumer: ${mode}`);
  const planPath = join(ROOT, '.cache/verify-ci/plan.json');
  const plan = existsSync(planPath)
    ? (JSON.parse(readFileSync(planPath, 'utf8')) as VerifyPlan)
    : null;
  if (mode === 'consumers' && !plan)
    throw new Error('Consumer evidence requires the immutable plan');
  const entries = archiveEntries(archive);
  extractEvidence(archive, evidencePaths(entries, mode, plan), ROOT);
}
