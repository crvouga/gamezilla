import { PROJECT_CONFIG } from '../../project-config';

/**
 * Markdown bullets linking to vendor consoles. Uses {@link PROJECT_CONFIG} for
 * stable public slugs. `CLOUDFLARE_ACCOUNT_ID` is read from the environment (e.g.
 * injected by `doppler run` in CI from the `shared` Doppler config); if unset,
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
      `- **Cloudflare Worker (API):** [\`${cloudflare.apiWorker}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${cloudflare.apiWorker}/production)`
    );
    lines.push(
      `- **Cloudflare Worker (Turbo cache):** [\`${cloudflare.turboCacheWorker}\`](https://dash.cloudflare.com/${accountId}/workers/services/view/${cloudflare.turboCacheWorker}/production)`
    );
  } else {
    lines.push(
      `- **Cloudflare:** [Dashboard](https://dash.cloudflare.com/) — add \`CLOUDFLARE_ACCOUNT_ID\` to Doppler (\`shared\`) for direct links to zone, Pages, R2, and Workers`
    );
  }

  lines.push('');
  return lines;
}
