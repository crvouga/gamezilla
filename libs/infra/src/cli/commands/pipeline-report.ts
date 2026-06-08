import { writePipelineReportToSummary } from '../lib/write-pipeline-report';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

export class PipelineReportCommand implements Command {
  readonly id = 'pipeline-report';
  readonly group = 'ci' as const;
  readonly summary =
    'Write GitHub Actions step summary from NEEDS_JSON (no Vault / lock)';

  constructor(_platform: CiPlatform) {}

  async execute(): Promise<void> {
    await writePipelineReportToSummary();
  }
}
