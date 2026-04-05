import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { readTfOutputs, type TfOutputs } from '../lib/tf-outputs';

const SUMMARY_SERVICES = [
  { label: 'Web App', outputKey: 'web_app_url' },
  { label: 'Req Res', outputKey: 'req_res_url' },
] as const;

const SUMMARY_INFRA = [
  { label: 'Aurora endpoint', outputKey: 'database_cluster_endpoint' },
  { label: 'Pub/Sub broker (VPC)', outputKey: 'pubsub_internal_mqtt_url' },
  { label: 'Pub/Sub broker NLB', outputKey: 'pubsub_public_nlb_dns' },
] as const;

const SUMMARY_NAMESERVERS = [
  { domain: 'gamezilla.app', outputKey: 'route53_nameservers' },
] as const;

export class SummaryCommand implements Command {
  readonly id = 'summary';
  readonly summary = 'Write CI job summary';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  execute(): void {
    ensureAwsEnvCredentials();
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
    const serviceRows = SUMMARY_SERVICES.map(({ label, outputKey }) => {
      const url = outputs[outputKey] ?? '_(unavailable)_';
      return `| **${label}** | ${url} |`;
    }).join('\n');

    const infraRows = SUMMARY_INFRA.map(({ label, outputKey }) => {
      const v = outputs[outputKey];
      const cell = v !== undefined && v !== '' ? v : '_(not in outputs)_';
      return `| **${label}** | ${cell} |`;
    }).join('\n');

    const nsBlocks = SUMMARY_NAMESERVERS.map(({ domain, outputKey }) => {
      const raw = outputs[outputKey];
      if (raw === undefined || raw === '') return '';
      const list = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => `- \`${s}\``)
        .join('\n');
      return `#### \`${domain}\`\n\nSet these nameservers at your domain registrar:\n\n${list}`;
    })
      .filter((b) => b.length > 0)
      .join('\n\n');

    const body = `## Deployment Complete (Terraform)

| Service | URL |
|---------|-----|
${serviceRows}

| Infra | Value |
|-------|-------|
${infraRows}

### Custom Domain Setup

${nsBlocks}
`;

    this.platform.appendJobSummary(body);
    this.platform.notice('Summary written.');
  }
}
