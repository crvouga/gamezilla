import type { SecretEntry } from './types';
import { SLUG_RE, psHeaders } from './planetscale';

export class PsOrg implements SecretEntry {
  readonly doppler = 'PLANETSCALE_ORG';
  readonly env = 'TF_VAR_planetscale_org';
  readonly hint = 'Your PlanetScale org slug (from URL: https://app.planetscale.com/<org>)';

  async validate(slug: string): Promise<string | null> {
    if (!SLUG_RE.test(slug)) return 'Must be a lowercase slug (e.g. "my-org")';
    const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
    const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
    if (!id || !token) return null;
    try {
      const res = await fetch(
        `https://api.planetscale.com/v1/organizations/${slug}`,
        { headers: psHeaders() },
      );
      if (res.ok) return null;
      if (res.status === 404) return `Organization "${slug}" not found`;
      if (res.status === 403)
        return `Token does not have access to org "${slug}"`;
      return `PlanetScale API returned HTTP ${res.status}`;
    } catch {
      return null;
    }
  }
}
