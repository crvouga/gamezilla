/**
 * Centralized settings for AWS CDK, deployment CLI, and GitHub OIDC setup.
 * Edit once; workflows and scripts read from here.
 */
export const PROJECT_CONFIG = {
  github: { owner: 'crvouga', repo: 'gamezilla.app' },
  aws: { region: 'us-east-1', bootstrapStackName: 'GamezillaGitHubOidc' },
  stack: { name: 'GamezillaStack' as const },
  /** IAM role name created by `bootstrap/github-oidc.template.json` (for CI preflight). */
  githubActionsRoleName: 'GamezillaGitHubActionsRole',
} as const;
