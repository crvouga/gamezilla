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
    turboCacheBucket: 'turborepo-cache',
    /** R2 bucket for cached TTS audio — must match `apps/api/wrangler.toml` `[[r2_buckets]] bucket_name`. */
    ttsAudioBucket: 'gamezilla-tts-audio',
    /** Worker name — must match `apps/api/wrangler.toml` `name`. */
    apiWorker: 'gamezilla-api',
    /** Worker name — must match `apps/turbo-cache/wrangler.toml` `name`. */
    turboCacheWorker: 'gamezilla-turbo-cache',
    /**
     * Hyperdrive config fronting the API Worker's PlanetScale Postgres
     * origin. A Cloudflare account can host multiple Hyperdrive configs
     * (one per origin), so each gets its own keyed entry under
     * `cloudflare.*Hyperdrive`. After the first `infra deploy`, replace
     * `id` with the UUID returned by Cloudflare and mirror it in
     * `apps/api/wrangler.toml` `[[hyperdrive]]`.
     */
    postgresHyperdrive: {
      name: 'gamezilla-api-postgres',
      id: '3b8852ba7f4a43a981f672e3140b6acd',
    },
  },
  /** PlanetScale org + database slugs (independent of GitHub `owner`/`repo`). */
  planetscale: {
    org: 'gamezilla',
    database: 'production',
  },
} as const;

/** HTTPS origin for the Turbo remote-cache Worker (custom domain).
 *
 * A WAF Custom Rule (`TurboCacheWafBotSkipRuleResource`) skips bot challenges for this
 * host so GH-hosted CI runners can use the zone edge directly. Other hosts
 * retain full bot protections; the Worker is still gated by `TURBO_TOKEN`. */
export function turboCachePublicUrl(): string {
  return `https://turbo-cache.${PROJECT_CONFIG.domain}`;
}
