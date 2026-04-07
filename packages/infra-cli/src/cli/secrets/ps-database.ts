import type { SecretEntry } from './types';
import { SLUG_RE, psHeaders } from './planetscale';

export class PsDatabase implements SecretEntry {
  readonly doppler = 'PLANETSCALE_DATABASE';
  readonly env = 'TF_VAR_planetscale_database';
  readonly hint = 'PlanetScale database name — must already exist (e.g. "production")';

  async validate(name: string): Promise<string | null> {
    if (!SLUG_RE.test(name))
      return 'Must be a lowercase slug (e.g. "production")';
    const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
    const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
    const org = process.env['TF_VAR_planetscale_org'];
    if (!id || !token || !org) return null;
    try {
      const res = await fetch(
        `https://api.planetscale.com/v1/organizations/${org}/databases/${name}`,
        { headers: psHeaders() },
      );
      if (res.ok) return null;
      if (res.status === 404)
        return `Database "${name}" not found in org "${org}" — create it at https://app.planetscale.com/${org}`;
      if (res.status === 403)
        return `Token does not have access to database "${name}"`;
      return `PlanetScale API returned HTTP ${res.status}`;
    } catch {
      return null;
    }
  }
}
