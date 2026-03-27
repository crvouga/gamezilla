import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { BaseCiCommand } from './base-command';
import { ghNotice, mustEnv } from './gh';

const TLS_NOTE =
  '**Bootstrap deploy:** ACM and the `www.gamezilla.app` CloudFront alias are skipped in CI so the stack does not block on DNS. After nameservers propagate, run `cdk deploy -c customDomain=true -c customDomainBootstrap=false` locally (or adjust this workflow) to add TLS and `https://www.gamezilla.app`.';

export class WriteDeploySummaryCommand extends BaseCiCommand {
  readonly id = 'write-deploy-summary';
  readonly summary = 'Append job summary markdown';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const summaryPath = mustEnv(
      process.env['GITHUB_STEP_SUMMARY'],
      'GITHUB_STEP_SUMMARY'
    );
    const webUrl = mustEnv(process.env['CI_WEB_URL'], 'CI_WEB_URL');
    const vizUrl = mustEnv(process.env['CI_VIZ_URL'], 'CI_VIZ_URL');
    const syncUrl = mustEnv(process.env['CI_SYNC_URL'], 'CI_SYNC_URL');
    const ns = mustEnv(process.env['CI_NAMESERVERS'], 'CI_NAMESERVERS');
    assert(
      summaryPath.length > 0 &&
        webUrl.length > 0 &&
        vizUrl.length > 0 &&
        syncUrl.length > 0 &&
        ns.length > 0
    );

    const body = `## Deployment Complete

| Service | URL |
|---------|-----|
| **Web App** | ${webUrl} |
| **Sim Viz** | ${vizUrl} |
| **Sync Server** | ${syncUrl} |

### Custom Domain Setup (\`www.gamezilla.app\`)

**Nameservers** — set these at [Squarespace Domains](https://account.squarespace.com/domains) → \`gamezilla.app\` → DNS → Nameservers → Use custom nameservers:

\`\`\`
${ns}
\`\`\`
`;
    appendFileSync(summaryPath, `${body}\n${TLS_NOTE}\n`, 'utf8');
    ghNotice('Job summary appended.');
  }
}
