import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { readTfOutputs, type TfOutputs } from '../lib/tf-outputs';

const SUMMARY_SERVICES = [
  { label: 'Web App', outputKey: 'web_app_url' },
  { label: 'API (Workers)', outputKey: 'api_url' },
  { label: 'Database (PlanetScale)', outputKey: 'database_url', redact: true },
] as const;

export class SummaryCommand implements Command {
  readonly id = 'summary';
  readonly summary = 'Write CI job summary';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  execute(): void {
    let outputs: TfOutputs;
    try {
      outputs = readTfOutputs(this.platform);
    } catch (e) {
      this.platform.warning(`Could not read Terraform outputs for summary: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    this.writeSummary(outputs);
  }

  private writeSummary(outputs: TfOutputs): void {
    const serviceRows = SUMMARY_SERVICES.map((svc) => {
      let url = outputs[svc.outputKey] ?? '_(unavailable)_';
      if ('redact' in svc && svc.redact && url !== '_(unavailable)_') url = '_(set)_';
      return `| **${svc.label}** | ${url} |`;
    }).join('\n');

    const body = `## Deployment Complete

| Service | URL |
|---------|-----|
${serviceRows}
`;

    this.platform.appendJobSummary(body);
    this.platform.notice('Summary written.');
  }
}
