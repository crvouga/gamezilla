export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    pagesProject: 'gamezilla-client',
    turboCacheBucket: 'turborepo-cache',
  },
} as const;

/** HTTPS origin for the Turbo remote-cache Worker (custom domain).
 *
 * A WAF Custom Rule (`WafBotSkipRuleResource`) skips bot challenges for this
 * host so GH-hosted CI runners can use the zone edge directly. Other hosts
 * retain full bot protections; the Worker is still gated by `TURBO_TOKEN`. */
export function turboCachePublicUrl(): string {
  return `https://turbo-cache.${PROJECT_CONFIG.domain}`;
}
