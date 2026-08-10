/**
 * Cloudflare DNS upsert helpers for custom domains (e.g. Railway EMQX).
 */
import { assert } from '@pkgs/assert';
import { cfHeaders } from '../secrets/cloudflare';
import { cliIo } from './cli-io';

const CF_API = 'https://api.cloudflare.com/client/v4';

type CfListBody = {
  readonly result?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly content: string;
  }>;
};

async function listRecords(
  zoneId: string,
  name: string,
  type: string
): Promise<ReadonlyArray<{ id: string; content: string }>> {
  const headers = cfHeaders();
  const url = new URL(`${CF_API}/zones/${zoneId}/dns_records`);
  url.searchParams.set('name', name);
  url.searchParams.set('type', type);
  url.searchParams.set('per_page', '50');
  const res = await cliIo.http.fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`CF DNS list failed: HTTP ${String(res.status)}`);
  }
  const body = (await res.json()) as CfListBody;
  return (body.result ?? []).map((r) => ({ id: r.id, content: r.content }));
}

export async function upsertDnsRecord(options: {
  readonly zoneId: string;
  readonly type: 'CNAME' | 'TXT';
  readonly name: string;
  readonly content: string;
  readonly proxied?: boolean;
}): Promise<void> {
  const headers = cfHeaders();
  const existing = await listRecords(
    options.zoneId,
    options.name,
    options.type
  );
  const payload = {
    type: options.type,
    name: options.name,
    content: options.content,
    ttl: 1,
    proxied: options.type === 'CNAME' ? (options.proxied ?? false) : undefined,
  };

  if (existing.length > 0) {
    const id = existing[0]!.id;
    const res = await cliIo.http.fetch(
      `${CF_API}/zones/${options.zoneId}/dns_records/${id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      }
    );
    assert.ok(res.ok, `CF DNS update failed: HTTP ${String(res.status)}`);
    return;
  }

  const res = await cliIo.http.fetch(
    `${CF_API}/zones/${options.zoneId}/dns_records`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }
  );
  assert.ok(res.ok, `CF DNS create failed: HTTP ${String(res.status)}`);
}

export async function deleteDnsRecordsByName(options: {
  readonly zoneId: string;
  readonly name: string;
  readonly types?: readonly ('CNAME' | 'TXT')[];
}): Promise<void> {
  const headers = cfHeaders();
  const types = options.types ?? (['CNAME', 'TXT'] as const);
  for (const type of types) {
    const existing = await listRecords(options.zoneId, options.name, type);
    for (const rec of existing) {
      await cliIo.http.fetch(
        `${CF_API}/zones/${options.zoneId}/dns_records/${rec.id}`,
        {
          method: 'DELETE',
          headers,
        }
      );
    }
  }
}
