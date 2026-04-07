import { neon, neonConfig } from '@neondatabase/serverless';
import type { SecretEntry } from './types';

export class PsDatabaseUrl implements SecretEntry {
  readonly doppler = 'PLANETSCALE_DATABASE_URL';
  readonly env = 'DATABASE_URL';
  readonly hint =
    'Postgres connection URL from PlanetScale (postgresql://user:pass@host/db?sslmode=require)';

  async validate(value: string): Promise<string | null> {
    if (!value.startsWith('postgresql://') && !value.startsWith('postgres://'))
      return 'Must start with postgresql:// or postgres://';

    let url: URL;
    try {
      url = new URL(value.replace(/^postgres(ql)?:\/\//, 'http://'));
    } catch {
      return 'Not a valid URL';
    }

    if (!url.username) return 'URL must include a username';
    if (!url.password) return 'URL must include a password';
    if (!url.hostname) return 'URL must include a hostname';

    try {
      neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
      const sql = neon(value);
      const rows = await sql`SELECT 1 AS ok`;
      if (!Array.isArray(rows) || rows.length === 0)
        return 'SELECT 1 returned no rows — database may be unreachable';
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return `HTTP connectivity check failed: ${msg}`;
    }
  }
}
