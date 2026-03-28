import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { BasePipelineCommand } from './base-command';
import {
  readCdkOutputs,
  requireOutput,
  type StackOutputs,
} from './cdk-outputs';
import { DEPLOY_REGISTRY } from './deploy-registry';
import { ghNotice } from './gh';

const SUMMARY_SERVICES = [
  { label: 'Web App', outputKey: 'WebAppUrl' },
  { label: 'PatchDB App', outputKey: 'PatchDbAppUrl' },
  { label: 'Sync Server', outputKey: 'SyncServerUrl' },
] as const;

const SUMMARY_NAMESERVERS = [
  { domain: 'gamezilla.app', outputKey: 'Route53Nameservers' },
  { domain: 'patchdb.dev', outputKey: 'PatchDbNameservers' },
] as const;

const TLS_NOTE =
  '**Bootstrap deploy:** ACM and CloudFront aliases are skipped in CI so the stack does not block on DNS. After nameservers propagate, run `cdk deploy -c customDomain=true -c customDomainBootstrap=false` locally (or adjust this workflow) to add TLS for `https://www.gamezilla.app` and `https://www.patchdb.dev`.';

export class DeployAppsCommand extends BasePipelineCommand {
  readonly id = 'deploy-apps';
  readonly summary = 'Read CDK outputs → deploy all registered apps → write summary';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const outputs = readCdkOutputs();

    for (const d of DEPLOY_REGISTRY) {
      ghNotice(`Deploying ${d.id}…`);
      d.deploy(outputs);
    }

    this.writeSummary(outputs);
  }

  private writeSummary(outputs: StackOutputs): void {
    const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
    if (summaryPath === undefined || summaryPath === '') {
      ghNotice('GITHUB_STEP_SUMMARY not set — skipping summary.');
      return;
    }

    const serviceRows = SUMMARY_SERVICES.map(({ label, outputKey }) => {
      const url = requireOutput(outputs, outputKey);
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

    appendFileSync(summaryPath, `${body}\n${TLS_NOTE}\n`, 'utf8');
    ghNotice('Job summary appended.');
  }
}
