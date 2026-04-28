import { PROJECT_CONFIG } from '../../project-config';

/** Must match `apps/api/wrangler.toml` and `apps/turbo-cache/wrangler.toml` `name`. */
const CLOUDFLARE_WORKER_NAMES = {
  api: 'gamezilla-api',
  turboCache: 'gamezilla-turbo-cache',
} as const;

/**
 * Markdown bullets linking to vendor consoles. Uses {@link PROJECT_CONFIG} for
 * stable public slugs. `CLOUDFLARE_ACCOUNT_ID` is read from the environment (e.g.
 * injected by `doppler run` in CI from the `shared` Doppler config); if unset,
 * generic Cloudflare dashboard links are used.
 */
export function buildVendorDashboardMarkdown(): string[] {
  const lines: string[] = [];
  const { domain, github, cloudflare } = PROJECT_CONFIG;
  const owner = github.owner;
  const repo = github.repo;
  const accountId = (process.env['CLOUDFLARE_ACCOUNT_ID'] ?? '').trim();
  const psOrg = owner;
  const psDb = repo;

  lines.push('### Cloud & vendor dashboards');
  lines.push('');
  lines.push(
    `- **GitHub:** [${owner}/${repo}](https://github.com/${owner}/${repo}) · [Actions](https://github.com/${owner}/${repo}/actions)`
  );
  lines.push(
    `- **PlanetScale:** [Organization](https://app.planetscale.com/${psOrg}) · [Database \`${psDb}\`](https://app.planetscale.com/${psOrg}/${psDb})`
  );
  lines.push(`- **Doppler:** [Dashboard](https://dashboard.doppler.com)`);
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
      `- **Cloudflare Pages:** [\`${cloudflare.pagesProject}\`](https://dash.cloudflare.com/${accountId}/pages/view/${cloudflare.pagesProject})`
    );
    lines.push(
      `- **Cloudflare R2:** [\`${cloudflare.turboCacheBucket}\`](https://dash.cloudflare.com/${accountId}/r2/default/buckets/${cloudflare.turboCacheBucket})`
    );
    lines.push(
      `- **Cloudflare Worker (API):** [\`${CLOUDFLARE_WORKER_NAMES.api}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${CLOUDFLARE_WORKER_NAMES.api}/production)`
    );
    lines.push(
      `- **Cloudflare Worker (Turbo cache):** [\`${CLOUDFLARE_WORKER_NAMES.turboCache}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${CLOUDFLARE_WORKER_NAMES.turboCache}/production)`
    );
  } else {
    lines.push(
      `- **Cloudflare:** [Dashboard](https://dash.cloudflare.com/) — add \`CLOUDFLARE_ACCOUNT_ID\` to Doppler (\`shared\`) for direct links to zone, Pages, R2, and Workers`
    );
  }

  lines.push('');
  return lines;
}
