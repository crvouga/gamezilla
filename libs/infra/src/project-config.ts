export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    /**
     * Production Worker script name. Top-level `name` in `apps/api/wrangler.toml`
     * is `gamezilla-api`; `wrangler deploy --env production` publishes as this.
     */
    apiWorker: 'gamezilla-api-production',
    /**
     * Assets-only production Worker. Top-level `name` in `apps/client/wrangler.toml`
     * is `gamezilla-client`; `wrangler deploy --env production` publishes as this.
     */
    clientWorker: 'gamezilla-client-production',
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
  emqx: {
    hostname: 'emqx.gamezilla.app',
    railwayProjectName: 'gamezilla',
    railwayServiceName: 'emqx',
    githubRootDirectory: 'apps/emqx',
    /** Container public listen port (Caddy → Railway `$PORT`). */
    targetPort: 8080,
  },
} as const;
