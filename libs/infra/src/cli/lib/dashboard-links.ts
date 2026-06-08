import { VAULT_DEFAULTS } from '@pkgs/vault';
import { PROJECT_CONFIG } from '../../project-config';

/**
 * Markdown bullets linking to vendor consoles. Uses {@link PROJECT_CONFIG} for
 * stable public slugs. `CLOUDFLARE_ACCOUNT_ID` is read from the environment (e.g.
 * injected by `vault run` in CI from the `shared` Vault config); if unset,
 * generic Cloudflare dashboard links are used.
 */
export function buildVendorDashboardMarkdown(): string[] {
  const lines: string[] = [];
  const { domain, github, cloudflare, planetscale } = PROJECT_CONFIG;
  const owner = github.owner;
  const repo = github.repo;
  const accountId = (process.env['CLOUDFLARE_ACCOUNT_ID'] ?? '').trim();
  const psOrg = planetscale.org;
  const psDb = planetscale.database;

  lines.push('### Cloud & vendor dashboards');
  lines.push('');
  lines.push(
    `- **GitHub:** [${owner}/${repo}](https://github.com/${owner}/${repo}) · [Actions](https://github.com/${owner}/${repo}/actions)`
  );
  lines.push(
    `- **PlanetScale:** [Organization \`${psOrg}\`](https://app.planetscale.com/${psOrg}) · [Database \`${psDb}\`](https://app.planetscale.com/${psOrg}/${psDb})`
  );
  lines.push(`- **Vault:** [Dashboard](${VAULT_DEFAULTS.addr})`);
  lines.push(
    `- **Vercel Remote Caching:** [Account tokens](https://vercel.com/account/tokens) · [Team settings](https://vercel.com/dashboard/usage)`
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
      `- **Cloudflare Worker (API + web):** [\`${cloudflare.apiWorker}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${cloudflare.apiWorker}/production)`
    );
  } else {
    lines.push(
      `- **Cloudflare:** [Dashboard](https://dash.cloudflare.com/) — add \`CLOUDFLARE_ACCOUNT_ID\` to Vault (\`shared\`) for direct links to zone and Workers`
    );
  }

  lines.push('');
  return lines;
}
