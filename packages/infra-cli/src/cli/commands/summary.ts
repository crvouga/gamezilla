import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { readTfOutputs, type TfOutputs } from '../lib/tf-outputs';

const SUMMARY_SERVICES = [
  { label: 'Web App', outputKey: 'web_app_url' },
  { label: 'Req Res', outputKey: 'req_res_url' },
] as const;

const SUMMARY_INFRA = [
  { label: 'EMQX (internal)', outputKey: 'pubsub_internal_mqtt_url' },
  { label: 'EMQX (public)', outputKey: 'pubsub_public_url' },
  { label: 'Req-res app', outputKey: 'req_res_app_name' },
  { label: 'Worker app', outputKey: 'worker_app_name' },
  { label: 'EMQX app', outputKey: 'emqx_app_name' },
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
    const serviceRows = SUMMARY_SERVICES.map(({ label, outputKey }) => {
      const url = outputs[outputKey] ?? '_(unavailable)_';
      return `| **${label}** | ${url} |`;
    }).join('\n');

    const infraRows = SUMMARY_INFRA.map(({ label, outputKey }) => {
      const v = outputs[outputKey];
      const cell = v !== undefined && v !== '' ? v : '_(not in outputs)_';
      return `| **${label}** | ${cell} |`;
    }).join('\n');

    const body = `## Deployment Complete

| Service | URL |
|---------|-----|
${serviceRows}

| Infra | Value |
|-------|-------|
${infraRows}
`;

    this.platform.appendJobSummary(body);
    this.platform.notice('Summary written.');
  }
}
