/**
 * What each resource type is, whose logo it wears, and where its console
 * lives. Console links are built only from values OpenTofu itself holds
 * (resource attributes and the stack's variables), so a rename in
 * configuration moves the link with it.
 *
 * A type missing here still renders (generic provider mark, no link); the
 * infra-map test fails until it is added, so the page never silently
 * under-describes the infrastructure.
 */

import type { Kind } from './infra-kind-helpers';
import { AWS_KINDS } from './infra-kinds-aws';
import { CLOUDFLARE_KINDS } from './infra-kinds-cloudflare';
import { GITHUB_KINDS } from './infra-kinds-github';
import { GRAFANA_KINDS } from './infra-kinds-grafana';
import { INFISICAL_KINDS } from './infra-kinds-infisical';
import { OTHER_KINDS } from './infra-kinds-other';
import { PLANETSCALE_KINDS } from './infra-kinds-planetscale';

export type {
  Category,
  ExternalRef,
  Kind,
  Link,
  LinkContext,
} from './infra-kind-helpers';

export const KINDS: Readonly<Record<string, Kind>> = {
  ...CLOUDFLARE_KINDS,
  ...GRAFANA_KINDS,
  ...PLANETSCALE_KINDS,
  ...INFISICAL_KINDS,
  ...GITHUB_KINDS,
  ...AWS_KINDS,
  ...OTHER_KINDS,
};

const PROVIDER_LOGO: Readonly<Record<string, string>> = {
  cloudflare: 'cloudflare',
  aws: 'aws',
  grafana: 'grafana',
  planetscale: 'planetscale',
  infisical: 'infisical',
  github: 'github',
  railway: 'railway',
  neon: 'neon',
  terraform: 'opentofu',
  random: 'hashicorp',
  archive: 'hashicorp',
};

/** The provider a resource type belongs to (`aws_iam_role` → `aws`). */
export function providerOf(type: string): string {
  return type.split('_')[0] ?? type;
}

export function kindOf(type: string): Kind {
  const known = KINDS[type];
  if (known !== undefined) return known;
  return {
    title: type,
    logo: PROVIDER_LOGO[providerOf(type)] ?? 'opentofu',
    category: 'Plumbing',
  };
}

export function providerLogo(provider: string): string {
  return PROVIDER_LOGO[provider] ?? 'opentofu';
}

const PROVIDER_TITLE: Readonly<Record<string, string>> = {
  cloudflare: 'Cloudflare',
  aws: 'AWS',
  grafana: 'Grafana Cloud',
  planetscale: 'PlanetScale',
  infisical: 'Infisical',
  github: 'GitHub',
  railway: 'Railway',
  neon: 'Neon',
  terraform: 'OpenTofu',
  random: 'HashiCorp',
  archive: 'HashiCorp',
};

export function providerTitle(provider: string): string {
  return PROVIDER_TITLE[provider] ?? provider;
}

/** The logo of a provider given its display title (see `providerTitle`). */
export function providerLogoOfTitle(title: string): string {
  const entry = Object.entries(PROVIDER_TITLE).find(([, t]) => t === title);
  return providerLogo(entry?.[0] ?? '');
}
