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
    /**
     * Hyperdrive config fronting the API Worker's PlanetScale Postgres
     * origin. A Cloudflare account can host multiple Hyperdrive configs
     * (one per origin), so each gets its own keyed entry under
     * `cloudflare.*Hyperdrive`. After the first `infra deploy`, replace
     * `id` with the UUID returned by Cloudflare and mirror it in
     * `apps/api/wrangler.toml` `[[hyperdrive]]`.
     */
    postgresHyperdrive: {
      name: 'gamezilla-api-postgres',
      id: '3b8852ba7f4a43a981f672e3140b6acd',
    },
  },
  /** PlanetScale org + database slugs (independent of GitHub `owner`/`repo`). */
  planetscale: {
    org: 'gamezilla',
    database: 'production',
  },
} as const;
