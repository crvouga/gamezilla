import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import {
  readCdkOutputs,
  requireOutput,
  type StackOutputs,
} from './cdk-outputs';
import type { CiPlatform } from './ci-platform';

const SUMMARY_SERVICES = [
  { label: 'Web App', outputKey: 'WebAppUrl' },
  { label: 'PatchDB App', outputKey: 'PatchDbAppUrl' },
  { label: 'Sync Server', outputKey: 'SyncServerUrl' },
] as const;

const SUMMARY_NAMESERVERS = [
  { domain: 'gamezilla.app', outputKey: 'Route53Nameservers' },
  { domain: 'patchdb.dev', outputKey: 'PatchDbNameservers' },
] as const;

const CUSTOM_DOMAIN_NOTE =
  '**Custom domain:** CI deploy uses `customDomainBootstrap=false` (TLS + `www` aliases). First-time setup: delegate NS at your registrar (see below), then run `bun run setup domains-finalize` from `packages/aws` if certs/aliases are not yet live.';

export class WriteSummaryCommand extends BasePipelineCommand {
  readonly id = 'write-summary';
  readonly summary = 'Read CDK outputs → write CI job summary';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  execute(argv: string[]): void {
    assert.array(argv, 'execute: argv must be an array');
    const outputs = readCdkOutputs(this.platform);
    this.writeSummary(outputs);
  }

  private writeSummary(outputs: StackOutputs): void {
    const serviceRows = SUMMARY_SERVICES.map(({ label, outputKey }) => {
      const url = requireOutput(this.platform, outputs, outputKey);
      return `| **${label}** | ${url} |`;
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
      return `#### \`${domain}\`\n\nSet these nameservers at your domain registrar → \`${domain}\` → DNS → Use custom nameservers:\n\n${list}`;
    })
      .filter((b) => b.length > 0)
      .join('\n\n');

    const body = `## Deployment Complete

| Service | URL |
|---------|-----|
${serviceRows}

### Custom Domain Setup

${nsBlocks}
`;

    this.platform.appendJobSummary(`${body}\n${CUSTOM_DOMAIN_NOTE}\n`);
    this.platform.notice('Summary written.');
  }
}
