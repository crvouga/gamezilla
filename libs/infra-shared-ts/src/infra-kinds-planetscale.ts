/** PlanetScale resource kinds. */

import type { Kind } from './infra-kind-helpers';
import { link, planetscale, text } from './infra-kind-helpers';

export const PLANETSCALE_KINDS: Readonly<Record<string, Kind>> = {
  planetscale_postgres_branch: {
    title: 'Postgres branch',
    logo: 'planetscale',
    category: 'Database',
    links: (c) => link('Database', planetscale(c, text(c.attrs, 'database'))),
  },
  planetscale_postgres_branch_role: {
    title: 'Postgres role',
    logo: 'planetscale',
    category: 'Identity & access',
    links: (c) => link('Database', planetscale(c, text(c.attrs, 'database'))),
  },
};
