export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    /** Worker name — must match `apps/api/wrangler.toml` `name`. */
    apiWorker: 'gamezilla',
  },
  postgres: {
    /** Schema owned by this app inside the shared Postgres database. */
    schema: 'gamezilla',
  },
  /** S3-compatible object storage — bucket and credentials are externally managed. */
  objectStore: {
    /** Key prefix enforced on every remote object-store write. */
    namespace: 'gamezilla',
  },
  /** PlanetScale org + database slugs (independent of GitHub `owner`/`repo`). */
  planetscale: {
    org: 'gamezilla',
    database: 'production',
  },
} as const;
