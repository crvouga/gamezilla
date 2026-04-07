import { readTfOutputs, type TfOutputs } from '../lib/tf-outputs';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

const SUMMARY_SERVICES = [
  { label: 'Client', outputKey: 'web_app_url' },
  { label: 'API (Workers)', outputKey: 'api_url' },
  { label: 'Database (D1)', outputKey: 'd1_database_id' },
] as const;

export class SummaryCommand implements Command {
  readonly id = 'summary';
  readonly summary = 'Write CI job summary';

  constructor(private readonly platform: CiPlatform) {}

  execute(): void {
    let outputs: TfOutputs;
    try {
      outputs = readTfOutputs(this.platform);
    } catch (e) {
      this.platform.warning(
        `Could not read Terraform outputs for summary: ${e instanceof Error ? e.message : String(e)}`
      );
      return;
    }
    this.writeSummary(outputs);
  }

  private writeSummary(outputs: TfOutputs): void {
    const serviceRows = SUMMARY_SERVICES.map((svc) => {
      let url = outputs[svc.outputKey] ?? '_(unavailable)_';
      if ('redact' in svc && svc.redact && url !== '_(unavailable)_')
        url = '_(set)_';
      return `| **${svc.label}** | ${url} |`;
    }).join('\n');

    const nameservers = outputs['cloudflare_nameservers'] ?? '_(unavailable)_';

    const body = `## Deployment Complete

| Service | URL |
|---------|-----|
${serviceRows}

### Squarespace Nameserver Setup (one-time)

Point your domain to Cloudflare in [Squarespace Domains](https://domains.squarespace.com):

**Nameservers:** \`${nameservers}\`

> DNS records and the apex-to-www redirect are managed by Cloudflare via Terraform.
> Once nameservers are delegated, no further Squarespace configuration is needed.
`;

    this.platform.appendJobSummary(body);
    this.platform.notice('Summary written.');
  }
}
