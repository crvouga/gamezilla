import { ok, warn } from '../lib/fmt';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import type { Resource } from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const DB_NAME = 'gamezilla-db';

export class DatabaseResource implements Resource {
  readonly id = 'database';

  async destroy(): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();
    if (!accountId) {
      warn('Database', 'missing Cloudflare account ID — skipping');
      return;
    }

    const dbId = await this.findDatabase(accountId, headers);
    if (!dbId) {
      ok('D1 database', 'not found — nothing to delete');
      return;
    }

    const res = await fetch(
      `${CF_API}/accounts/${accountId}/d1/database/${dbId}`,
      { method: 'DELETE', headers }
    );

    if (res.ok) {
      ok('D1 database deleted', DB_NAME);
    } else {
      const body = await res.text();
      warn('D1 database delete', `HTTP ${res.status}: ${body}`);
    }
  }

  private async findDatabase(
    accountId: string,
    headers: Record<string, string>
  ): Promise<string | null> {
    const res = await fetch(
      `${CF_API}/accounts/${accountId}/d1/database?name=${DB_NAME}&per_page=1`,
      { headers }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: Array<{ uuid: string; name: string }>;
    };
    const match = body.result?.find((db) => db.name === DB_NAME);
    return match?.uuid ?? null;
  }
}
