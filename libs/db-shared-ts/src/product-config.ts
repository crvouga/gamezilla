import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';

/**
 * Product constants that are the same in every environment. Anything that
 * names a deployed resource (Workers, buckets, hostnames, the broker, the
 * Grafana stack) is infrastructure and lives in `libs/infra-shared-ts/tofu` — its
 * per-environment values in `libs/infra-shared-ts/tofu/envs/<env>.tfvars.json`.
 */
export const PRODUCT_CONFIG = {
  postgres: {
    /** Application tables live in the standard Postgres `public` schema. */
    schema: 'public',
    /**
     * Hostnames that must never appear in a non-production environment.
     * Primary prod detection is dual-fetch against every production
     * environment's `DATABASE_URL`.
     */
    productionHostnames: [] as const,
  },
  objectStore: {
    /** Key prefix enforced on every remote object-store write. */
    namespace: NAMESPACE,
  },
} as const;
