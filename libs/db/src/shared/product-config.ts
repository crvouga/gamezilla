export const PRODUCT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    /**
     * Production Worker script name. Top-level `name` in `apps/server/wrangler.toml`
     * is `gamezilla-api`; `wrangler deploy --env production` publishes as this.
     */
    apiWorker: 'gamezilla-api-production',
    /**
     * Room server Durable Object Worker. Top-level `name` in `apps/room-server/wrangler.toml`
     * is `gamezilla-room`; production publishes as this. API binds ROOM via
     * `script_name`.
     */
    roomWorker: 'gamezilla-room-production',
    /**
     * Assets-only production Worker (super-app). Top-level `name` in
     * `apps/product/wrangler.toml` is `gamezilla-client`; `wrangler deploy
     * --env production` publishes as this. Serves `/` (wall client) and
     * `/console` (Tests + Simulator).
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
   * S3-compatible object storage. Runtime uses `S3_ACCESS_KEY_ID` /
   * `S3_SECRET_ACCESS_KEY` + `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION`;
   * buckets are provisioned on Cloudflare R2 via `CLOUDFLARE_API_TOKEN`.
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
    /**
     * Required when the Railway account has multiple workspaces (projectCreate
     * needs an explicit workspaceId). Leave empty for a single-workspace account.
     */
    railwayWorkspaceName: "Chris Vouga's Projects",
    railwayServiceName: 'emqx',
    githubRootDirectory: 'libs/pubsub/emqx-deploy',
    /** Container public listen port (Caddy → Railway `$PORT`). */
    targetPort: 8080,
  },
} as const;
