import { getSecretsDashboardUrl } from '@pkgs/secret-provider';
import { PROJECT_CONFIG } from '../../project-config';

/**
 * Markdown bullets linking to vendor consoles. Uses {@link PROJECT_CONFIG} for
 * stable public slugs. `CLOUDFLARE_ACCOUNT_ID` is read from the environment (e.g.
 * injected by `secrets-run` in CI); if unset, generic Cloudflare dashboard links are used.
 */
export function buildVendorDashboardMarkdown(): string[] {
  const lines: string[] = [];
  const { domain, github, cloudflare } = PROJECT_CONFIG;
  const owner = github.owner;
  const repo = github.repo;
  const accountId = (process.env['CLOUDFLARE_ACCOUNT_ID'] ?? '').trim();

  lines.push('### Cloud & vendor dashboards');
  lines.push('');
  lines.push(
    `- **GitHub:** [${owner}/${repo}](https://github.com/${owner}/${repo}) · [Actions](https://github.com/${owner}/${repo}/actions)`
  );
  lines.push(`- **Secrets:** [Dashboard](${getSecretsDashboardUrl()})`);
  lines.push(
    `- **Turbo remote cache:** [turborepo.chrisvouga.dev](https://turborepo.chrisvouga.dev) (self-hosted; secrets \`TURBO_API\` / \`TURBO_TOKEN\` / \`TURBO_TEAM\`)`
  );
  lines.push(
    `- **Squarespace Domains:** [domains.squarespace.com](https://domains.squarespace.com)`
  );

  if (accountId !== '') {
    lines.push(
      `- **Cloudflare (account):** [Home](https://dash.cloudflare.com/${accountId}/home)`
    );
    lines.push(
      `- **Cloudflare DNS / zone:** [\`${domain}\`](https://dash.cloudflare.com/${accountId}/${domain})`
    );
    lines.push(
      `- **Cloudflare Worker (API):** [\`${cloudflare.apiWorker}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${cloudflare.apiWorker}/production)`
    );
    lines.push(
      `- **Cloudflare Worker (client):** [\`${cloudflare.clientWorker}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${cloudflare.clientWorker}/production)`
    );
  } else {
    lines.push(
      `- **Cloudflare:** [Dashboard](https://dash.cloudflare.com/) — add \`CLOUDFLARE_ACCOUNT_ID\` to the secret store for direct links to zone and Workers`
    );
  }

  lines.push('');
  return lines;
}
