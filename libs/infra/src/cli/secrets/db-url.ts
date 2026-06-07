import type { SecretEntry } from './types';

const POSTGRES_URL_PREFIX = /^(postgres|postgresql):\/\//i;

export class DbUrl implements SecretEntry {
  readonly secretKey = 'DATABASE_URL';
  readonly env = 'DATABASE_URL';
  readonly hint =
    'Postgres connection URL (postgresql://…) or local PGlite HTTP (http://127.0.0.1:15432)';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty';
    if (!POSTGRES_URL_PREFIX.test(v) && !v.startsWith('http://')) {
      return 'Must start with postgres://, postgresql://, or http://';
    }
    try {
      new URL(v);
    } catch {
      return 'Must be a valid URL';
    }
    return null;
  }
}
