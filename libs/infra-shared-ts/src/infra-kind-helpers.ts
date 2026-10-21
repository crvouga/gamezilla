/** Shared types and link builders for the resource-kind catalogs. */

import type { Value } from './hcl-value';
import { isList, isObject, isUnknown } from './hcl-value';

export type Link = { readonly label: string; readonly href: string };

export type Category =
  | 'Storage'
  | 'Database'
  | 'Compute'
  | 'Networking'
  | 'Identity & access'
  | 'Secrets'
  | 'Observability'
  | 'Source control'
  | 'Plumbing';

export type LinkContext = {
  readonly attrs: Readonly<Record<string, Value>>;
  readonly vars: Readonly<Record<string, Value>>;
};

/** Something outside OpenTofu a resource points at (e.g. a Worker script). */
export type ExternalRef = {
  readonly title: string;
  readonly name: string;
  readonly logo: string;
  readonly note: string;
};

export type Kind = {
  readonly title: string;
  readonly logo: string;
  readonly category: Category;
  readonly links?: (ctx: LinkContext) => readonly Link[];
  readonly external?: (ctx: LinkContext) => ExternalRef | null;
};

/** A plain string at `path`, or null when absent, unknown or not a string. */
export function text(
  root: Value | undefined,
  ...path: string[]
): string | null {
  let cur: Value | undefined = root;
  for (const step of path) {
    if (cur === undefined || isUnknown(cur)) return null;
    if (isObject(cur)) cur = (cur as Record<string, Value>)[step];
    else if (isList(cur)) cur = cur[Number(step)];
    else return null;
  }
  return typeof cur === 'string' && cur !== '' ? cur : null;
}

export function link(label: string, href: string | null): readonly Link[] {
  return href === null ? [] : [{ label, href }];
}

export const CF = 'https://dash.cloudflare.com';
export const accountOf = (c: LinkContext): string | null =>
  text(c.attrs, 'account_id') ??
  text(c.vars, 'cloudflare', 'account_id') ??
  text(c.vars, 'reports', 'account_id');

export const cf = (c: LinkContext, path: string): string | null => {
  const account = accountOf(c);
  return account === null ? null : `${CF}/${account}${path}`;
};

export const zoneName = (c: LinkContext): string | null =>
  text(c.vars, 'cloudflare', 'zone_name') ??
  text(c.vars, 'auth_relay', 'zone_name');

export const bucketLink = (c: LinkContext, name: string | null): Link[] => [
  ...link(
    'R2 bucket',
    name === null ? null : cf(c, `/r2/default/buckets/${name}`)
  ),
];

export const gh = (c: LinkContext, path = ''): string | null => {
  const owner = text(c.vars, 'github', 'owner');
  const repo = text(c.vars, 'github', 'repo');
  return owner === null || repo === null
    ? null
    : `https://github.com/${owner}/${repo}${path}`;
};

export const awsRegion = (c: LinkContext): string =>
  text(c.vars, 'aws', 'region') ?? 'us-east-1';

export const awsConsole = (
  c: LinkContext,
  service: string,
  hash = ''
): string =>
  `https://${awsRegion(c)}.console.aws.amazon.com/${service}/home?region=${awsRegion(c)}${hash}`;

export const grafana = (c: LinkContext, path = ''): string | null => {
  const slug = text(c.vars, 'grafana', 'stack_slug');
  return slug === null ? null : `https://${slug}.grafana.net${path}`;
};

export const planetscale = (
  c: LinkContext,
  database: string | null
): string | null => {
  const org = text(c.vars, 'planetscale', 'organization');
  return org === null || database === null
    ? null
    : `https://app.planetscale.com/${org}/${database}`;
};

export const infisical = (c: LinkContext, path = ''): string | null => {
  const org = text(c.vars, 'infisical', 'org_id');
  const project = text(c.vars, 'infisical', 'project_id');
  if (org === null || project === null) return null;
  return `https://app.infisical.com/organizations/${org}/projects/secret-management/${project}${path}`;
};

export const infisicalOrg = (c: LinkContext, path: string): string | null => {
  const org = text(c.vars, 'infisical', 'org_id');
  return org === null
    ? null
    : `https://app.infisical.com/organizations/${org}${path}`;
};

export const secretsEnv = (c: LinkContext): readonly Link[] =>
  link('Secrets', infisical(c, '/overview'));

export const settings = (label: string, path: string) => (c: LinkContext) =>
  link(label, gh(c, path));

export const iam = (path: string) => () =>
  link('IAM console', `https://console.aws.amazon.com/iam/home#${path}`);

export const none = (): readonly Link[] => [];

export const GRAFANA_ADMIN = 'https://grafana.com/profile/org';
