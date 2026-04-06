export const PROJECT_CONFIG = {
  github: {
    owner: 'crvouga',
    repo: 'gamezilla.app',
  },
  aws: {
    region: 'us-east-1',
    bootstrapStackName: 'GamezillaGitHubOidc',
  },
  githubActionsRoleName: 'GamezillaGitHubActionsRole',
} as const;
