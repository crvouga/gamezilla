/** GitHub resource kinds. */

import type { Kind } from './infra-kind-helpers';
import { gh, link, settings } from './infra-kind-helpers';

export const GITHUB_KINDS: Readonly<Record<string, Kind>> = {
  github_repository: {
    title: 'Repository',
    logo: 'github',
    category: 'Source control',
    links: (c) => link('Repository', gh(c)),
  },
  github_branch_default: {
    title: 'Default branch',
    logo: 'github',
    category: 'Source control',
    links: settings('Branches', '/settings/branches'),
  },
  github_repository_ruleset: {
    title: 'Branch ruleset',
    logo: 'github',
    category: 'Source control',
    links: settings('Rulesets', '/settings/rules'),
  },
  github_actions_variable: {
    title: 'Actions variable',
    logo: 'github-actions',
    category: 'Source control',
    links: settings('Variables', '/settings/variables/actions'),
  },
  github_actions_repository_permissions: {
    title: 'Actions policy',
    logo: 'github-actions',
    category: 'Source control',
    links: settings('Actions settings', '/settings/actions'),
  },
  github_workflow_repository_permissions: {
    title: 'Workflow token permissions',
    logo: 'github-actions',
    category: 'Source control',
    links: settings('Actions settings', '/settings/actions'),
  },
  github_repository_environment: {
    title: 'Deployment environment',
    logo: 'github-actions',
    category: 'Source control',
    links: settings('Environments', '/settings/environments'),
  },
  github_repository_environment_deployment_policy: {
    title: 'Deployment branch policy',
    logo: 'github-actions',
    category: 'Source control',
    links: settings('Environments', '/settings/environments'),
  },
  github_repository_vulnerability_alerts: {
    title: 'Dependency alerts',
    logo: 'github',
    category: 'Source control',
    links: settings('Security', '/settings/security_analysis'),
  },
  github_repository_dependabot_security_updates: {
    title: 'Dependabot security updates',
    logo: 'github',
    category: 'Source control',
    links: settings('Security', '/settings/security_analysis'),
  },
};
