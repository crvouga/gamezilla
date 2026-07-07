export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    /** Worker name — must match `[env.production].name` in `apps/api/wrangler.toml`. */
    apiWorker: 'gamezilla',
    /** Retired Workers removed on every deploy by `ensure-destroyed`. */
    legacyWorkers: ['gamezilla-api', 'gamezilla-production'] as const,
    /** Retired Cloudflare Pages project (web client was split out pre-unified Worker). */
    legacyPagesProject: 'gamezilla-client',
  },
  postgres: {
    /** Schema owned by this app inside the shared Postgres database. */
    schema: 'gamezilla',
    /**
     * Hostnames that must never appear when `SECRETS_ENV !== 'prd'`.
     * Primary prod detection is dual-fetch against secrets env `prd` `DATABASE_URL`.
     */
    productionHostnames: [] as const,
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
