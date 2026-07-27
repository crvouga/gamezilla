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
   * S3-compatible object storage. Runtime uses `B2_APP_*` + `S3_BUCKET` /
   * `S3_ENDPOINT` / `S3_REGION`; buckets are provisioned on Backblaze B2 by
   * the infra `s3-bucket` resource using `B2_MASTER_*`.
   */
  objectStore: {
    /** Key prefix enforced on every remote object-store write. */
    namespace: 'gamezilla',
    buckets: {
      /** Secrets env `dev`. */
      development: 'gamezilla-development',
      /** Secrets env `prd`. */
      production: 'gamezilla-production',
    },
  },
} as const;
