export const PROJECT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  cloudflare: {
    pagesProject: 'gamezilla-client',
    turboCacheWorker: 'gamezilla-turbo-cache',
    turboCacheBucket: 'turborepo-cache',
    accountSubdomain: 'crvouga',
  },
} as const;

/** HTTPS origin for the Turbo remote-cache Worker (custom domain, not *.workers.dev). */
export function turboCachePublicUrl(): string {
  return `https://turbo-cache.${PROJECT_CONFIG.domain}`;
}
