export const PROJECT_CONFIG = {
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  fly: {
    org: 'personal',
    region: 'iad',
    apps: {
      reqRes: 'gamezilla-req-res',
      worker: 'gamezilla-worker',
      emqx: 'gamezilla-emqx',
    },
  },
  cloudflare: {
    pagesProject: 'gamezilla',
  },
  planetscale: {
    org: 'crvouga',
    database: 'gamezilla',
  },
} as const;
