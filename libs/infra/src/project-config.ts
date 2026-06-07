export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    /**
     * Cloudflare Pages project hosting the web client (`apps/client`).
     * A Cloudflare account can host multiple Pages projects, so each
     * gets its own keyed entry under `cloudflare.*PagesProject`.
     */
    clientPagesProject: 'gamezilla-client',
    /** Worker name — must match `apps/api/wrangler.toml` `name`. */
    apiWorker: 'gamezilla-api',
    /**
     * Catch-all R2 bucket for object storage — must match
     * `apps/api/wrangler.toml` `[[r2_buckets]] bucket_name`.
     */
    objectStoreBucket: 'gamezilla',
  },
  /** PlanetScale org + database slugs (independent of GitHub `owner`/`repo`). */
  planetscale: {
    org: 'gamezilla',
    database: 'production',
  },
} as const;
