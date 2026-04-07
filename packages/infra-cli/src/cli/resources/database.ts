import { ok, warn } from '../lib/fmt';
import { psHeaders } from '../secrets/planetscale';
import type { Resource } from './types';

const PS_API = 'https://api.planetscale.com/v1';

export class DatabaseResource implements Resource {
  readonly id = 'database';

  async destroy(): Promise<void> {
    const org = process.env['TF_VAR_planetscale_org'];
    const db = process.env['TF_VAR_planetscale_database'];
    if (!org || !db) {
      warn('Database', 'missing PLANETSCALE_ORG or PLANETSCALE_DATABASE — skipping');
      return;
    }

    const headers = psHeaders();

    await this.deletePasswords(org, db, 'main', headers);
    await this.deleteBranch(org, db, 'main', headers);
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
      if (res.status === 404) return;
      warn('PlanetScale passwords list', `HTTP ${res.status}`);
      return;
    }

    const body = (await res.json()) as {
      data?: Array<{ id: string; name: string }>;
    };
    const passwords = body.data ?? [];

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

  private async deleteBranch(
    org: string,
    db: string,
    branch: string,
    headers: Record<string, string>
  ): Promise<void> {
    const url = `${PS_API}/organizations/${org}/databases/${db}/branches/${branch}`;
    const res = await fetch(url, { method: 'DELETE', headers });

    if (res.ok) {
      ok('Branch deleted', `${db}/${branch}`);
    } else if (res.status === 404) {
      ok('Branch', `${db}/${branch} — not found`);
    } else {
      const body = await res.text();
      warn('Branch delete', `${db}/${branch} — HTTP ${res.status}: ${body}`);
    }
  }
}
