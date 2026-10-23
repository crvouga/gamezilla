/**
 * One card per provider: its logo, how many declared resources it carries,
 * the pinned version, and the account-level identifiers and consoles that
 * come straight from `global.tfvars.json`.
 */

import { text } from './infra-kind-helpers';
import type { Link } from './infra-kinds';
import type { InfraModel, ProviderUse } from './infra-model-types';
import { logoTile } from './infra-render-logo';
import { esc, plural } from './infra-render-text';

type Facts = {
  readonly title: string;
  readonly logo: string;
  /** Provider names (in `required_providers`) that roll up into this card. */
  readonly providers: readonly string[];
  readonly facts: (vars: Record<string, unknown>) => [string, string | null][];
  readonly links: (vars: Record<string, unknown>) => Link[];
};

const pick = (vars: Record<string, unknown>, ...path: string[]) =>
  text(vars as never, ...path);

const present = (links: [string, string | null][]): Link[] =>
  links.flatMap(([label, href]) => (href === null ? [] : [{ label, href }]));

const CLOUDFLARE = 'https://dash.cloudflare.com';

const CARDS: readonly Facts[] = [
  {
    title: 'Cloudflare',
    logo: 'cloudflare',
    providers: ['cloudflare'],
    facts: (v) => [
      ['Account', pick(v, 'state', 'account_id')],
      ['Zone', pick(v, 'auth_relay', 'zone_name')],
      ['State bucket', pick(v, 'state', 'bucket')],
    ],
    links: (v) => {
      const account = pick(v, 'state', 'account_id');
      if (account === null) return [];
      const zone = pick(v, 'auth_relay', 'zone_name');
      return present([
        ['Dashboard', `${CLOUDFLARE}/${account}`],
        ['R2', `${CLOUDFLARE}/${account}/r2/default/overview`],
        ['Workers', `${CLOUDFLARE}/${account}/workers-and-pages`],
        [
          'DNS',
          zone === null ? null : `${CLOUDFLARE}/${account}/${zone}/dns/records`,
        ],
      ]);
    },
  },
  {
    title: 'AWS',
    logo: 'aws',
    providers: ['aws'],
    facts: (v) => [['Region', pick(v, 'aws', 'region')]],
    links: (v) => {
      const region = pick(v, 'aws', 'region') ?? 'us-east-1';
      const console = `https://${region}.console.aws.amazon.com`;
      return [
        { label: 'IoT Core', href: `${console}/iot/home?region=${region}` },
        { label: 'Lambda', href: `${console}/lambda/home?region=${region}` },
        { label: 'IAM', href: 'https://console.aws.amazon.com/iam/home' },
      ];
    },
  },
  {
    title: 'Grafana Cloud',
    logo: 'grafana',
    providers: ['grafana'],
    facts: (v) => [
      ['Stack', pick(v, 'grafana', 'stack_slug')],
      ['Region', pick(v, 'grafana', 'region')],
    ],
    links: (v) => {
      const slug = pick(v, 'grafana', 'stack_slug');
      if (slug === null) return [];
      const base = `https://${slug}.grafana.net`;
      return [
        { label: 'Stack', href: base },
        { label: 'Dashboards', href: `${base}/dashboards` },
        { label: 'Alerting', href: `${base}/alerting/list` },
      ];
    },
  },
  {
    title: 'PlanetScale',
    logo: 'planetscale',
    providers: ['planetscale'],
    facts: (v) => [
      ['Organization', pick(v, 'planetscale', 'organization')],
      ['Region', pick(v, 'planetscale', 'region')],
    ],
    links: (v) => {
      const org = pick(v, 'planetscale', 'organization');
      return present([
        [
          'Organization',
          org === null ? null : `https://app.planetscale.com/${org}`,
        ],
      ]);
    },
  },
  {
    title: 'Infisical',
    logo: 'infisical',
    providers: ['infisical'],
    facts: (v) => [
      ['Project', pick(v, 'infisical', 'project_slug')],
      ['Shared environment', pick(v, 'infisical', 'shared_env')],
    ],
    links: (v) => {
      const org = pick(v, 'infisical', 'org_id');
      const project = pick(v, 'infisical', 'project_id');
      return present([
        [
          'Project',
          org === null || project === null
            ? null
            : `https://app.infisical.com/organizations/${org}/projects/secret-management/${project}/overview`,
        ],
      ]);
    },
  },
  {
    title: 'GitHub',
    logo: 'github',
    providers: ['github'],
    facts: (v) => [
      [
        'Repository',
        `${pick(v, 'github', 'owner')}/${pick(v, 'github', 'repo')}`,
      ],
    ],
    links: (v) => {
      const owner = pick(v, 'github', 'owner');
      const repo = pick(v, 'github', 'repo');
      if (owner === null || repo === null) return [];
      const base = `https://github.com/${owner}/${repo}`;
      return [
        { label: 'Repository', href: base },
        { label: 'Actions', href: `${base}/actions` },
        { label: 'Rulesets', href: `${base}/settings/rules` },
      ];
    },
  },
  {
    title: 'Railway',
    logo: 'railway',
    providers: ['railway'],
    facts: (v) => [['Workspace', pick(v, 'railway', 'workspace_id')]],
    links: () => [
      { label: 'Dashboard', href: 'https://railway.com/dashboard' },
    ],
  },
  {
    title: 'HashiCorp helpers',
    logo: 'hashicorp',
    providers: ['random', 'archive'],
    facts: () => [],
    links: () => [],
  },
];

function pinnedVersions(
  model: InfraModel,
  names: readonly string[]
): ProviderUse[] {
  const seen = new Map<string, ProviderUse>();
  const stacks = [...model.globals, ...model.envs.flatMap((e) => e.stacks)];
  for (const stack of stacks) {
    for (const use of stack.providers) {
      if (names.includes(use.name)) seen.set(use.name, use);
    }
  }
  return [...seen.values()];
}

function declared(model: InfraModel, names: readonly string[]): number {
  const seen = new Set<string>();
  const stacks = [...model.globals, ...model.envs.flatMap((e) => e.stacks)];
  for (const stack of stacks) {
    for (const node of stack.nodes) {
      if (node.mode === 'managed' && names.includes(node.provider)) {
        seen.add(`${stack.stack}:${node.address}`);
      }
    }
  }
  return seen.size;
}

function card(model: InfraModel, spec: Facts): string {
  const vars = model.vars as Record<string, unknown>;
  const pins = pinnedVersions(model, spec.providers)
    .map(
      (p) =>
        `<span class="pin" title="${esc(`${p.source ?? p.name} ${p.constraint ?? ''}`)}">${esc(p.name)} ${esc(p.locked ?? p.constraint ?? '')}</span>`
    )
    .join('');
  const facts = spec
    .facts(vars)
    .filter(([, value]) => value !== null && !value.includes('null'))
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v ?? '')}</dd></div>`)
    .join('');
  const links = spec
    .links(vars)
    .map(
      (l) =>
        `<a class="btn" href="${esc(l.href)}" target="_blank" rel="noreferrer noopener">${esc(l.label)}<span aria-hidden="true"> ↗</span></a>`
    )
    .join('');
  const count = declared(model, spec.providers);
  return `<article class="provider">
<header>${logoTile(spec.logo, 40)}<div><h3>${esc(spec.title)}</h3><div class="muted">${esc(plural(count, 'declared resource'))}</div></div></header>
<dl>${facts}</dl>
<div class="pins">${pins}</div>
<div class="provider-links">${links}</div>
</article>`;
}

export function renderProviders(model: InfraModel): string {
  const used = new Set(
    [...model.globals, ...model.envs.flatMap((e) => e.stacks)].flatMap((s) =>
      s.nodes.map((n) => n.provider)
    )
  );
  return `<div class="providers">${CARDS.filter((c) =>
    c.providers.some((p) => used.has(p))
  )
    .map((c) => card(model, c))
    .join('')}</div>`;
}
