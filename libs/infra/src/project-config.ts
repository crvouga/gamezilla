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
  },
  /** Backblaze B2 object storage — bucket and keys are externally managed. */
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
