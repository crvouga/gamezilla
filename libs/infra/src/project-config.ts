export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    /** Worker name — must match `[env.production].name` in `apps/api/wrangler.toml`. */
    apiWorker: 'gamezilla-api',
    /** Assets-only Worker — must match `[env.production].name` in `apps/client/wrangler.toml`. */
    clientWorker: 'gamezilla-client',
    /**
     * Retired Workers removed on every deploy by `ensure-destroyed`.
     * Includes the pre-split unified Worker (`gamezilla`) and the brief
     * `gamezilla-www` assets-only name before `gamezilla-client`.
     */
    legacyWorkers: [
      'gamezilla',
      'gamezilla-www',
      'gamezilla-production',
    ] as const,
    /** Retired Cloudflare Pages project name (distinct from the Worker `clientWorker`). */
    legacyPagesProject: 'gamezilla-client',
  },
  postgres: {
    /** Application tables live in the standard Postgres `public` schema. */
    schema: 'public',
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
