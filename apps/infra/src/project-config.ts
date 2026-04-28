export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    pagesProject: 'gamezilla-client',
    turboCacheBucket: 'turborepo-cache',
    /** Worker name — must match `apps/api/wrangler.toml` `name`. */
    apiWorker: 'gamezilla-api',
    /** Worker name — must match `apps/turbo-cache/wrangler.toml` `name`. */
    turboCacheWorker: 'gamezilla-turbo-cache',
  },
  /** PlanetScale org + database slugs (independent of GitHub `owner`/`repo`). */
  planetscale: {
    org: 'gamezilla',
    database: 'production',
  },
} as const;

/** HTTPS origin for the Turbo remote-cache Worker (custom domain).
 *
 * A WAF Custom Rule (`WafBotSkipRuleResource`) skips bot challenges for this
 * host so GH-hosted CI runners can use the zone edge directly. Other hosts
 * retain full bot protections; the Worker is still gated by `TURBO_TOKEN`. */
export function turboCachePublicUrl(): string {
  return `https://turbo-cache.${PROJECT_CONFIG.domain}`;
}
