import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LOGOS } from '@libs/infra-shared-ts/infra-logos';
import { buildInfraModel } from '@libs/infra-shared-ts/infra-model';
import type {
  InfraModel,
  NodeModel,
  StackModel,
} from '@libs/infra-shared-ts/infra-model-types';
import { renderInfraMap } from '@libs/infra-shared-ts/infra-render';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

/**
 * The infrastructure map is derived from the OpenTofu source, so these tests
 * run it over the real tree: nothing declared may go missing from the page,
 * and nothing new may arrive without a name, a logo and (where one exists) a
 * console link.
 */
const PKG = join(import.meta.dirname, '..');
const SOURCE = /(\.tf|\.json|\.tftpl|\.hcl|\.rego)$/;
const SKIP = new Set(['.terraform', 'node_modules', '.cache']);

function collect(dir: string, into: Map<string, string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, into);
    else if (SOURCE.test(entry.name)) {
      into.set(slashPath(relative(PKG, path)), readFileSync(path, 'utf8'));
    }
  }
}

const SOURCES = new Map<string, string>();
collect(join(PKG, 'tofu'), SOURCES);
collect(join(PKG, 'policy'), SOURCES);

const MODEL: InfraModel = buildInfraModel(SOURCES);
const STACKS: readonly StackModel[] = [
  ...MODEL.globals,
  ...MODEL.envs.flatMap((e) => e.stacks),
];
const HTML = renderInfraMap(MODEL, { digest: 'test' });

/** Module directories a stack reaches, by following `source = "../…"`. */
function reachableDirs(dir: string, into: Set<string>): void {
  if (into.has(dir)) return;
  into.add(dir);
  for (const [path, text] of SOURCES) {
    if (!path.startsWith(`${dir}/`) || !path.endsWith('.tf')) continue;
    if (path.slice(dir.length + 1).includes('/')) continue;
    for (const m of text.matchAll(/^\s*source\s*=\s*"(\.[^"]+)"/gm)) {
      const parts = `${dir}/${m[1]}`.split('/');
      const out: string[] = [];
      for (const part of parts) {
        if (part === '..') out.pop();
        else if (part !== '.') out.push(part);
      }
      reachableDirs(out.join('/'), into);
    }
  }
}

/** `resource "t" "n"` and `data "t" "n"` text-scanned, not parsed. */
function declaredIn(dirs: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const [path, text] of SOURCES) {
    const dir = path.slice(0, path.lastIndexOf('/'));
    if (!dirs.has(dir) || !path.endsWith('.tf')) continue;
    const code = text.replace(/^\s*#.*$/gm, '');
    for (const m of code.matchAll(
      /^(resource|data)\s+"([^"]+)"\s+"([^"]+)"/gm
    )) {
      found.push(`${m[1] === 'data' ? 'data.' : ''}${m[2]}.${m[3]}`);
    }
  }
  return found;
}

function suffixes(stack: StackModel): Set<string> {
  return new Set(
    stack.nodes.map((n) => n.address.replace(/^(module\.[^.]+\.)+/, ''))
  );
}

function find(stack: StackModel, address: string): NodeModel {
  const found = stack.nodes.find((n) => n.address === address);
  if (found === undefined) throw new Error(`no ${address} in ${stack.stack}`);
  return found;
}

const env = (name: string) => {
  const found = MODEL.envs.find((e) => e.env === name);
  if (found === undefined) throw new Error(`no environment ${name}`);
  return found;
};
const stack = (e: ReturnType<typeof env>, name: string) =>
  e.stacks.find((s) => s.stack === name) as StackModel;

describe('infrastructure map model', () => {
  test('shared reference data belongs to the global fleet and survives environment retirement', () => {
    const fleet = MODEL.globals.find((s) => s.stack === 'fleet')!;
    const bucket = find(fleet, 'cloudflare_r2_bucket.shared_data');
    expect(bucket.instances.map((instance) => instance.label)).toEqual([
      technicalName(['shared']),
    ]);
    expect(bucket.preventDestroy).toBe(true);
    expect(bucket.stateful).toBe(true);
    for (const env of MODEL.envs) {
      expect(
        env.stacks
          .flatMap((s) => s.nodes)
          .some((n) => n.address === bucket.address)
      ).toBe(false);
    }
    const credentials = find(fleet, 'infisical_secret.shared_data');
    expect(credentials.instances).toHaveLength(5);
    expect(fleet.edges).toContainEqual({
      from: 'terraform_data.shared_data_version',
      to: 'infisical_secret.shared_data',
    });
  });

  test('every file parses', () => {
    expect(STACKS.flatMap((s) => s.diagnostics)).toEqual([]);
  });

  test('every declared resource reaches the model', () => {
    for (const s of STACKS) {
      const dirs = new Set<string>();
      reachableDirs(s.dir, dirs);
      const have = suffixes(s);
      const missing = declaredIn(dirs).filter((d) => !have.has(d));
      expect(missing).toEqual([]);
    }
  });

  test('every resource type has a title, a known logo and a category', () => {
    const logos = new Set(LOGOS.map((l) => l.id));
    const uncatalogued = new Set<string>();
    const unlogoed = new Set<string>();
    for (const s of STACKS) {
      for (const n of s.nodes) {
        if (n.title === n.type) uncatalogued.add(n.type);
        if (!logos.has(n.logo)) unlogoed.add(n.logo);
      }
    }
    expect([...uncatalogued]).toEqual([]);
    expect([...unlogoed]).toEqual([]);
  });

  test('every managed resource that has a console also links to it', () => {
    const linkless = STACKS.flatMap((s) => s.nodes)
      .filter((n) => n.mode === 'managed' && n.category !== 'Plumbing')
      .filter((n) => n.category !== 'Secrets')
      .filter((n) => n.instances.length > 0)
      .filter((n) => n.instances.every((i) => i.links.length === 0))
      .map((n) => n.type);
    expect([...new Set(linkless)].sort()).toEqual([]);
  });

  test('names come from the environment, not from a hard-coded value', () => {
    const bucket = (e: string) =>
      find(
        stack(env(e), 'foundation'),
        'module.object_store.cloudflare_r2_bucket.objects'
      ).instances[0]?.label;
    expect(bucket('prd')).toBe(technicalName(['production']));
    expect(bucket('dev')).toBe(technicalName(['development']));
  });

  test('count expands per environment protection', () => {
    const branch = (e: string, which: 'production' | 'standard') =>
      find(
        stack(env(e), 'foundation'),
        `module.database.planetscale_postgres_branch.${which}`
      ).instances.length;
    expect([branch('prd', 'production'), branch('prd', 'standard')]).toEqual([
      1, 0,
    ]);
    expect([branch('dev', 'production'), branch('dev', 'standard')]).toEqual([
      0, 1,
    ]);
  });

  test('for_each expands to the instance keys', () => {
    const domains = find(
      stack(env('prd'), 'edge'),
      'module.edge.cloudflare_workers_custom_domain.this'
    );
    expect(domains.instances.map((i) => i.key)).toEqual(['apex', 'api', 'web']);
    expect(domains.externals.map((x) => x.name)).toEqual([
      technicalName(['prod']),
    ]);
  });

  test('dependencies resolve through variables, locals and module outputs', () => {
    const f = stack(env('prd'), 'foundation');
    const has = (from: string, to: string) =>
      f.edges.some((e) => e.from === from && e.to === to);
    expect(
      has(
        'module.pubsub.aws_iam_role.authorizer',
        'module.pubsub.aws_lambda_function.authorizer'
      )
    ).toBe(true);
    expect(
      has(
        'module.database.planetscale_postgres_branch_role.migrate',
        'module.secrets.infisical_secret.managed'
      )
    ).toBe(true);
    expect(
      has(
        'module.database.planetscale_postgres_branch_role.app',
        'module.database.cloudflare_hyperdrive_config.this'
      )
    ).toBe(true);
  });

  test('a resource the policy never deletes is stateful', () => {
    const f = stack(env('prd'), 'foundation');
    expect(
      find(f, 'module.object_store.cloudflare_r2_bucket.objects').stateful
    ).toBe(true);
    expect(
      find(f, 'module.object_store.cloudflare_account_token.s3').stateful
    ).toBe(false);
  });

  test('forgotten resources are listed as retired', () => {
    const removed = stack(env('prd'), 'foundation').removed;
    expect(removed.some((r) => r.address.includes('neon_branch'))).toBe(true);
    expect(removed.every((r) => r.destroy === false)).toBe(true);
  });
});

describe('infrastructure map page', () => {
  test('is deterministic', () => {
    expect(renderInfraMap(MODEL, { digest: 'test' })).toBe(HTML);
  });

  test('is one self-contained document', () => {
    expect(HTML).not.toMatch(/<script/i);
    expect(HTML).not.toMatch(/(src|href)="https?:\/\/[^"]*\.(js|css|png|svg)"/);
    expect(HTML).not.toContain('<link');
  });

  test('carries every environment hostname and its console links', () => {
    for (const e of MODEL.envs) {
      for (const host of Object.values(e.hosts)) expect(HTML).toContain(host);
    }
    const production = technicalName(['production']);
    expect(HTML).toContain(
      `https://dash.cloudflare.com/2698e76355a8c8d1ee21e15fa9fd44f7/r2/default/buckets/${production}`
    );
    expect(HTML).toContain(
      `https://github.com/${PRODUCT.external.sourceRepository}/settings/rules`
    );
    expect(HTML).toContain('https://shortawning2091.grafana.net');
    expect(HTML).toContain(
      `app.planetscale.com/${PRODUCT.external.planetscaleOrganization}/${production}`
    );
  });

  test('draws a logo for every provider it uses', () => {
    for (const id of [
      'cloudflare',
      'aws',
      'grafana',
      'planetscale',
      'infisical',
      'github',
      'railway',
    ]) {
      expect(HTML).toContain(`<symbol id="logo-${id}"`);
      expect(HTML).toContain(`href="#logo-${id}"`);
    }
  });

  test('never prints an unresolved value', () => {
    expect(HTML).not.toMatch(/undefined|\[object Object\]|Symbol\(/);
  });
});
