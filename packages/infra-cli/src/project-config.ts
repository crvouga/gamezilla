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
