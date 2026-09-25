/**
 * Product constants that are the same in every environment. Anything that
 * names a deployed resource (Workers, buckets, hostnames, the broker, the
 * Grafana stack) is infrastructure and lives in `libs/infra/tofu` — its
 * per-environment values in `libs/infra/tofu/envs/<env>.tfvars.json`.
 */
export const PRODUCT_CONFIG = {
  postgres: {
    /** Application tables live in the standard Postgres `public` schema. */
    schema: 'public',
    /**
     * Hostnames that must never appear when `SECRETS_ENV !== 'prd'`.
     * Primary prod detection is dual-fetch against secrets env `prd` `DATABASE_URL`.
     */
    productionHostnames: [] as const,
  },
  objectStore: {
    /** Key prefix enforced on every remote object-store write. */
    namespace: 'gamezilla',
  },
} as const;
