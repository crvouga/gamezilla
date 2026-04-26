import type { SecretEntry } from './types';

const POSTGRES_URL_PREFIX = /^(postgres|postgresql):\/\//i;

export class PsDatabaseUrl implements SecretEntry {
  readonly doppler = 'PLANETSCALE_DATABASE_URL';
  readonly env = 'PLANETSCALE_DATABASE_URL';
  readonly hint =
    'PlanetScale Postgres connection URL (postgresql://…), from PlanetScale dashboard or branch credentials';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty';
    if (!POSTGRES_URL_PREFIX.test(v)) {
      return 'Must start with postgres:// or postgresql://';
    }
    try {
      new URL(v);
    } catch {
      return 'Must be a valid URL';
    }
    return null;
  }
}
