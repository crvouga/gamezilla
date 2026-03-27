import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { BasePipelineCommand } from './base-command';
import { ghNotice, mustEnv } from './gh';

const TLS_NOTE =
  '**Bootstrap deploy:** ACM and CloudFront aliases are skipped in CI so the stack does not block on DNS. After nameservers propagate, run `cdk deploy -c customDomain=true -c customDomainBootstrap=false` locally (or adjust this workflow) to add TLS for `https://www.gamezilla.app` and `https://patchdb.dev`.';

export class WriteDeploySummaryCommand extends BasePipelineCommand {
  readonly id = 'write-deploy-summary';
  readonly summary = 'Append job summary markdown';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const summaryPath = mustEnv(
      process.env['GITHUB_STEP_SUMMARY'],
      'GITHUB_STEP_SUMMARY'
    );
    const webUrl = mustEnv(process.env['CI_WEB_URL'], 'CI_WEB_URL');
    const vizUrl = mustEnv(
      process.env['CI_PATCH_DB_APP_URL'],
      'CI_PATCH_DB_APP_URL'
    );
    const syncUrl = mustEnv(process.env['CI_SYNC_URL'], 'CI_SYNC_URL');
    const ns = mustEnv(process.env['CI_NAMESERVERS'], 'CI_NAMESERVERS');
    const patchdbNs = mustEnv(
      process.env['CI_PATCHDB_NAMESERVERS'],
      'CI_PATCHDB_NAMESERVERS'
    );
    assert(
      summaryPath.length > 0 &&
        webUrl.length > 0 &&
        vizUrl.length > 0 &&
        syncUrl.length > 0 &&
        ns.length > 0 &&
        patchdbNs.length > 0
    );

    const formatNsList = (raw: string): string =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => `- \`${s}\``)
        .join('\n');

    const body = `## Deployment Complete

| Service | URL |
|---------|-----|
| **Web App** | ${webUrl} |
| **PatchDB App** | ${vizUrl} |
| **Sync Server** | ${syncUrl} |

### Custom Domain Setup

#### \`www.gamezilla.app\`

Set these nameservers at your domain registrar → \`gamezilla.app\` → DNS → Use custom nameservers:

${formatNsList(ns)}

#### \`patchdb.dev\`

Set these nameservers at your domain registrar → \`patchdb.dev\` → DNS → Use custom nameservers:

${formatNsList(patchdbNs)}
`;
    appendFileSync(summaryPath, `${body}\n${TLS_NOTE}\n`, 'utf8');
    ghNotice('Job summary appended.');
  }
}
