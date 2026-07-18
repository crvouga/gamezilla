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
  /**
   * S3-compatible object storage. Runtime uses `S3_*` secrets only;
   * buckets are provisioned on Cloudflare R2 by the infra `s3-bucket` resource.
   */
  objectStore: {
    /** Key prefix enforced on every remote object-store write. */
    namespace: 'gamezilla',
    buckets: {
      /** Infisical secrets env `dev`. */
      development: 'gamezilla-development',
      /** Infisical secrets env `prd`. */
      production: 'gamezilla-production',
    },
  },
} as const;
