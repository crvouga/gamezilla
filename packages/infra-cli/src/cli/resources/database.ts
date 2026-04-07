import { ok, warn } from '../lib/fmt';
import { psHeaders } from '../secrets/planetscale';
import type { Resource } from './types';

const PS_API = 'https://api.planetscale.com/v1';

/**
 * Best-effort cleanup for PlanetScale branch passwords/roles.
 * The default branch ("main") cannot be deleted, so we only
 * remove passwords created on it.
 */
export class DatabaseResource implements Resource {
  readonly id = 'database';

  async destroy(): Promise<void> {
    const org = process.env['TF_VAR_planetscale_org'];
    const db = process.env['TF_VAR_planetscale_database'];
    if (!org || !db) {
      warn('Database', 'missing PLANETSCALE_ORG or PLANETSCALE_DATABASE — skipping');
      return;
    }

    await this.deletePasswords(org, db, 'main', psHeaders());
  }

  private async deletePasswords(
    org: string,
    db: string,
    branch: string,
    headers: Record<string, string>
  ): Promise<void> {
    const url = `${PS_API}/organizations/${org}/databases/${db}/branches/${branch}/passwords`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404) {
        ok('Database passwords', 'none found');
        return;
      }
      warn('Database passwords list', `HTTP ${res.status} — skipping`);
      return;
    }

    const body = (await res.json()) as {
      data?: Array<{ id: string; name: string }>;
    };
    const passwords = body.data ?? [];
    if (passwords.length === 0) {
      ok('Database passwords', 'none to delete');
      return;
    }

    for (const pw of passwords) {
      const del = await fetch(`${url}/${pw.id}`, {
        method: 'DELETE',
        headers,
      });
      if (del.ok || del.status === 404) {
        ok('Deleted password', pw.name || pw.id);
      } else {
        warn('Password delete', `${pw.name || pw.id} — HTTP ${del.status}`);
      }
    }
  }
}
