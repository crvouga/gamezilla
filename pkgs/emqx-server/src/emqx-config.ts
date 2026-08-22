/** EMQX / Railway product constants (owned by @pkgs/emqx-server). */
export const EMQX_PRODUCT_CONFIG = {
  domain: 'gamezilla.app',
  github: {
    owner: 'crvouga',
    repo: 'gamezilla',
  },
  emqx: {
    hostname: 'emqx.gamezilla.app',
    railwayProjectName: 'gamezilla',
    railwayWorkspaceName: "Chris Vouga's Projects",
    railwayServiceName: 'emqx',
    githubRootDirectory: 'pkgs/emqx-server/emqx-deploy',
    targetPort: 8080,
  },
} as const;
