/** Cloudflare resource kinds. */

import type { Kind } from './infra-kind-helpers';
import {
  bucketLink,
  cf,
  link,
  none,
  text,
  zoneName,
} from './infra-kind-helpers';

export const CLOUDFLARE_KINDS: Readonly<Record<string, Kind>> = {
  cloudflare_r2_bucket: {
    title: 'R2 bucket',
    logo: 'cloudflare',
    category: 'Storage',
    links: (c) => bucketLink(c, text(c.attrs, 'name')),
  },
  cloudflare_r2_bucket_lifecycle: {
    title: 'R2 lifecycle rules',
    logo: 'cloudflare',
    category: 'Storage',
    links: (c) => {
      const bucket = text(c.attrs, 'bucket_name');
      return link(
        'Bucket settings',
        bucket === null ? null : cf(c, `/r2/default/buckets/${bucket}/settings`)
      );
    },
  },
  cloudflare_account_token: {
    title: 'API token',
    logo: 'cloudflare',
    category: 'Identity & access',
    links: (c) => link('Account API tokens', cf(c, '/api-tokens')),
  },
  cloudflare_hyperdrive_config: {
    title: 'Hyperdrive config',
    logo: 'cloudflare',
    category: 'Database',
    links: (c) => link('Hyperdrive', cf(c, '/workers/hyperdrive')),
  },
  cloudflare_workers_custom_domain: {
    title: 'Worker custom domain',
    logo: 'cloudflare-workers',
    category: 'Networking',
    external: (c) => {
      const name = text(c.attrs, 'service');
      return name === null
        ? null
        : {
            title: 'Worker script',
            name,
            logo: 'cloudflare-workers',
            note: 'Deployed by wrangler, not OpenTofu',
          };
    },
    links: (c) => {
      const host = text(c.attrs, 'hostname');
      const service = text(c.attrs, 'service');
      return [
        ...link('Open site', host === null ? null : `https://${host}`),
        ...link(
          'Worker',
          service === null
            ? null
            : cf(c, `/workers/services/view/${service}/production`)
        ),
      ];
    },
  },
  cloudflare_dns_record: {
    title: 'DNS record',
    logo: 'cloudflare',
    category: 'Networking',
    links: (c) => {
      const zone = zoneName(c);
      return link('DNS', zone === null ? null : cf(c, `/${zone}/dns/records`));
    },
  },
  cloudflare_zone: {
    title: 'DNS zone',
    logo: 'cloudflare',
    category: 'Networking',
    links: (c) => {
      const zone = text(c.attrs, 'filter', 'name') ?? zoneName(c);
      return link('Zone', zone === null ? null : cf(c, `/${zone}`));
    },
  },
  cloudflare_account_api_token_permission_groups_list: {
    title: 'Permission group lookup',
    logo: 'cloudflare',
    category: 'Plumbing',
    links: none,
  },
};
