/** Railway and OpenTofu/HashiCorp built-in resource kinds. */

import type { Kind } from './infra-kind-helpers';
import { link } from './infra-kind-helpers';

export const OTHER_KINDS: Readonly<Record<string, Kind>> = {
  terraform_remote_state: {
    title: 'Encrypted stack outputs',
    logo: 'opentofu',
    category: 'Plumbing',
  },
  railway_project: {
    title: 'Railway project',
    logo: 'railway',
    category: 'Compute',
    links: () => link('Railway', 'https://railway.com/dashboard'),
  },
  railway_service: {
    title: 'Railway service',
    logo: 'railway',
    category: 'Compute',
    links: () => link('Railway', 'https://railway.com/dashboard'),
  },
  railway_environment: {
    title: 'Railway environment',
    logo: 'railway',
    category: 'Compute',
    links: () => link('Railway', 'https://railway.com/dashboard'),
  },
  railway_variable_collection: {
    title: 'Service variables',
    logo: 'railway',
    category: 'Compute',
    links: () => link('Railway', 'https://railway.com/dashboard'),
  },
  railway_service_instance: {
    title: 'Service instance',
    logo: 'railway',
    category: 'Compute',
    links: () => link('Railway', 'https://railway.com/dashboard'),
  },
  terraform_data: {
    title: 'Plan-time value holder',
    logo: 'opentofu',
    category: 'Plumbing',
  },
  random_password: {
    title: 'Generated secret',
    logo: 'hashicorp',
    category: 'Secrets',
  },
  archive_file: {
    title: 'Packaged source',
    logo: 'hashicorp',
    category: 'Plumbing',
  },
};
