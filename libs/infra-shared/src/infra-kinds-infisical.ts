/** Infisical resource kinds. */

import type { Kind } from './infra-kind-helpers';
import { infisicalOrg, link, secretsEnv } from './infra-kind-helpers';

export const INFISICAL_KINDS: Readonly<Record<string, Kind>> = {
  infisical_project_environment: {
    title: 'Secrets environment',
    logo: 'infisical',
    category: 'Secrets',
    links: secretsEnv,
  },
  infisical_secret: {
    title: 'Secret',
    logo: 'infisical',
    category: 'Secrets',
    links: secretsEnv,
  },
  infisical_secret_import: {
    title: 'Secret import',
    logo: 'infisical',
    category: 'Secrets',
    links: secretsEnv,
  },
  infisical_identity: {
    title: 'Machine identity',
    logo: 'infisical',
    category: 'Identity & access',
    links: (c) => link('Access control', infisicalOrg(c, '/access-management')),
  },
  infisical_identity_oidc_auth: {
    title: 'OIDC trust',
    logo: 'infisical',
    category: 'Identity & access',
    links: (c) => link('Access control', infisicalOrg(c, '/access-management')),
  },
  infisical_project_identity: {
    title: 'Project membership',
    logo: 'infisical',
    category: 'Identity & access',
    links: secretsEnv,
  },
  infisical_secrets: {
    title: 'Secrets lookup',
    logo: 'infisical',
    category: 'Plumbing',
    links: secretsEnv,
  },
};
