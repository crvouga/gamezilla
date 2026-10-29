import { describe, expect, test } from 'bun:test';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import {
  GLOBAL_STACKS,
  STACKS,
  type Target,
  varFileArgs,
  varFiles,
} from '@libs/infra-shared-ts/tofu-command';
import { resolvedVarFiles } from '@libs/infra-shared-ts/tofu-var-files';
import { resolveGlobalVars } from '@libs/infra-shared-ts/tofu-vars';
import {
  apiHost,
  brandHost,
  brandOrigin,
} from '@libs/product-identity-shared-ts/brand-hosts';
import { IDENTITY_PLACEHOLDERS } from '@libs/product-identity-shared-ts/identity-placeholders';
import {
  NAMESPACE,
  PRODUCT,
  PRODUCT_NAME,
} from '@libs/product-identity-shared-ts/product-identity';
import { syntheticIdentity } from '@libs/product-identity-shared-ts/synthetic-identity';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';

/**
 * The committed var files hold placeholders; OpenTofu reads these resolved
 * copies. Every value is pinned from the identity, so a resolved file that
 * differs from what the infrastructure was created with fails here before a
 * plan could rename anything.
 */
const FILES = resolvedVarFiles();
const ACCOUNT = '2698e76355a8c8d1ee21e15fa9fd44f7';
const [OWNER, REPO] = PRODUCT.external.sourceRepository.split('/');

function parsed(
  files: ReadonlyMap<string, string>,
  path: string
): Record<string, unknown> {
  const text = files.get(path);
  if (text === undefined) throw new Error(`no resolved ${path}`);
  return JSON.parse(text) as Record<string, unknown>;
}

describe('resolved OpenTofu var files', () => {
  test('global: names follow the namespace, hosts the domain, accounts the external ids', () => {
    expect(parsed(FILES, 'global.tfvars.json')).toMatchObject({
      project: NAMESPACE,
      brand_name: PRODUCT_NAME,
      state: { account_id: ACCOUNT, bucket: technicalName(['tofu', 'state']) },
      planetscale: {
        organization: PRODUCT.external.planetscaleOrganization,
        region: 'us-east',
      },
      github: {
        owner: OWNER,
        repo: REPO,
        settings: { homepage_url: brandOrigin() },
        environments: [...PRODUCT.external.githubEnvironments, 'production'],
      },
      auth_relay: {
        account_id: ACCOUNT,
        zone_name: brandHost(),
        hostname: brandHost('auth'),
        worker: technicalName(['auth', 'relay']),
      },
      global_imports: { github_repository: REPO },
      shared_data: { account_id: ACCOUNT, bucket: technicalName(['shared']) },
      ci_artifacts: {
        account_id: ACCOUNT,
        bucket: technicalName(['ci', 'artifacts']),
      },
    });
  });

  test('dev: its Worker and retired Workers follow the namespace, its hosts the domain', () => {
    expect(parsed(FILES, 'envs/dev.tfvars.json')).toMatchObject({
      worker: {
        name: technicalName(['dev']),
        transfer_rooms_from: technicalName(['room', 'development']),
        retire: [
          technicalName(['api', 'development']),
          technicalName(['client', 'development']),
          technicalName(['room', 'development']),
        ],
      },
      cloudflare: { account_id: ACCOUNT, zone_name: brandHost() },
      hosts: {
        apex: brandHost('dev'),
        web: brandHost('www-dev'),
        api: brandHost('api-dev'),
        broker: brandHost('emqx-dev'),
      },
    });
  });

  test('prd: its Worker, retired Workers and adopted bucket follow the namespace, its hosts the domain', () => {
    expect(parsed(FILES, 'envs/prd.tfvars.json')).toMatchObject({
      worker: {
        name: technicalName(['prod']),
        transfer_rooms_from: technicalName(['room', 'production']),
        retire: [
          technicalName(['api', 'production']),
          technicalName(['client', 'production']),
          technicalName(['room', 'production']),
        ],
      },
      cloudflare: { account_id: ACCOUNT, zone_name: brandHost() },
      hosts: {
        apex: brandHost(),
        web: brandHost('www'),
        api: apiHost(),
        broker: brandHost('emqx'),
      },
      imports: {
        foundation: {
          r2_bucket: `${ACCOUNT}/${technicalName(['production'])}/default`,
        },
      },
    });
  });

  test('a global stack reads every env file by name', () => {
    const { envs } = parsed(FILES, 'envs.tfvars.json') as {
      envs: Record<string, unknown>;
    };
    expect(Object.keys(envs).sort()).toEqual(Object.keys(ENV_FILES).sort());
    for (const name of Object.keys(ENV_FILES))
      expect(envs[name]).toEqual(parsed(FILES, `envs/${name}.tfvars.json`));
  });

  test('no placeholder reaches OpenTofu', () => {
    for (const [path, text] of FILES)
      for (const name of IDENTITY_PLACEHOLDERS)
        expect({ path, placeholder: text.includes(`{${name}}`) }).toEqual({
          path,
          placeholder: false,
        });
  });

  test('TypeScript readers see the values OpenTofu receives', () => {
    const global = parsed(FILES, 'global.tfvars.json');
    expect(GLOBAL).toMatchObject(global);
    for (const [name, env] of Object.entries(ENV_FILES))
      expect(env).toMatchObject(parsed(FILES, `envs/${name}.tfvars.json`));
  });

  test('every file a stack is handed is written, under the tofu cache', () => {
    const paths = { tofuDir: '/repo/tofu', cacheDir: '/repo/cache' };
    const targets = STACKS.flatMap((stack): Target[] =>
      GLOBAL_STACKS.includes(stack)
        ? [{ stack, env: null }]
        : Object.keys(ENV_FILES).map((env) => ({ stack, env }))
    );
    for (const target of targets) {
      for (const file of varFiles(target)) expect(FILES.has(file)).toBe(true);
      for (const arg of varFileArgs(paths, target))
        expect(arg).toStartWith('-var-file=/repo/cache/vars/');
    }
  });

  test('an identifier registered elsewhere comes only from the identity', () => {
    expect(() =>
      resolveGlobalVars({ github: { repo: 'another-repository' } })
    ).toThrow('github.repo');
    expect(() =>
      resolveGlobalVars({ planetscale: { organization: 'another-org' } })
    ).toThrow('planetscale.organization');
  });
});

type Leaves = Map<string, unknown>;

function leaves(value: unknown, path: string, into: Leaves): Leaves {
  if (typeof value === 'object' && value !== null)
    for (const [key, item] of Object.entries(value))
      leaves(item, path === '' ? key : `${path}.${key}`, into);
  else into.set(path, value);
  return into;
}

function changedLeaves(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
): Map<string, unknown> {
  const changed = new Map<string, unknown>();
  for (const [file, text] of before) {
    const was = leaves(JSON.parse(text), '', new Map());
    const now = leaves(JSON.parse(after.get(file) ?? '{}'), '', new Map());
    expect([...now.keys()]).toEqual([...was.keys()]);
    for (const [path, value] of was)
      if (now.get(path) !== value)
        changed.set(`${file}:${path}`, now.get(path));
  }
  return changed;
}

describe('a rebrand', () => {
  test('changes only hostnames, the zone, the homepage and the display name; every namespace-derived name stays', () => {
    const synthetic = syntheticIdentity();
    const changed = changedLeaves(FILES, resolvedVarFiles(synthetic));
    const hostsOf = (prefix: string) =>
      [
        'cloudflare.zone_name',
        ...['apex', 'web', 'api', 'broker'].map((h) => `hosts.${h}`),
      ].map((path) => `${prefix}${path}`);
    expect([...changed.keys()].sort()).toEqual(
      [
        'global.tfvars.json:brand_name',
        'global.tfvars.json:github.settings.homepage_url',
        'global.tfvars.json:auth_relay.zone_name',
        'global.tfvars.json:auth_relay.hostname',
        ...Object.keys(ENV_FILES).flatMap((env) => [
          ...hostsOf(`envs/${env}.tfvars.json:`),
          ...hostsOf(`envs.tfvars.json:envs.${env}.`),
        ]),
      ].sort()
    );
    for (const [path, value] of changed) {
      if (path.endsWith(':brand_name'))
        expect(value).toBe(synthetic.brand.name);
      else expect(String(value)).toEndWith(synthetic.brand.domain);
    }
  });
});
