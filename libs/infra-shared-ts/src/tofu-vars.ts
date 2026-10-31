/**
 * The committed OpenTofu variable files spell no product name, domain or
 * namespace: they hold `{namespace}` / `{domain}` / `{brand}` placeholders
 * and leave out the identifiers registered with other services. These
 * resolve a file to the values OpenTofu and every TypeScript reader see,
 * from the product identity (`@libs/product-identity-shared-ts`).
 *
 * The namespace never changes and the domain only with the brand, so a
 * resolved file is the file as it was before the placeholders.
 */
import { resolveIdentityPlaceholders } from '@libs/product-identity-shared-ts/identity-placeholders';
import {
  PRODUCT,
  type ProductIdentity,
} from '@libs/product-identity-shared-ts/product-identity';

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

/** Keys the identity's `external` fills in, by section of `global.tfvars.json`. */
const EXTERNAL_KEYS: Readonly<Record<string, readonly string[]>> = {
  planetscale: ['organization'],
  github: ['owner', 'repo'],
  global_imports: ['github_repository'],
};

function refuseExternalKeys(vars: Json): void {
  for (const [section, keys] of Object.entries(EXTERNAL_KEYS)) {
    for (const key of keys) {
      if (key in object(vars[section]))
        throw new Error(
          `global.tfvars.json: ${section}.${key} comes from the product identity's external identifiers; remove it from the file`
        );
    }
  }
}

/**
 * `global.tfvars.json` as OpenTofu receives it: placeholders resolved, and
 * the identifiers registered elsewhere filled in from the identity's
 * `external` — the repository (`github.owner` / `github.repo`, adopted as
 * `global_imports.github_repository`), the PlanetScale organization, and
 * the GitHub environments named after the repository, ahead of the
 * file's own `github.environments`.
 */
export function resolveGlobalVars(
  source: unknown,
  identity: ProductIdentity = PRODUCT
): Json {
  const vars = object(resolveIdentityPlaceholders(source, identity));
  refuseExternalKeys(vars);
  const { external } = identity;
  const [owner = '', repo = ''] = external.sourceRepository.split('/');
  const github = object(vars['github']);
  const listed = Array.isArray(github['environments'])
    ? github['environments']
    : [];
  const resolved: Json = {
    ...vars,
    planetscale: {
      ...object(vars['planetscale']),
      organization: external.planetscaleOrganization,
    },
    github: {
      owner,
      ...github,
      repo,
      environments: [...external.githubEnvironments, ...listed],
    },
  };
  if ('global_imports' in vars)
    resolved['global_imports'] = {
      ...object(vars['global_imports']),
      github_repository: repo,
    };
  return resolved;
}

/** An env file (`envs/<env>.tfvars.json`) as OpenTofu receives it. */
export function resolveEnvVars(
  source: unknown,
  identity: ProductIdentity = PRODUCT
): Json {
  return object(resolveIdentityPlaceholders(source, identity));
}
