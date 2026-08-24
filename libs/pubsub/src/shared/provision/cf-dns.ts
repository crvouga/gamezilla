// @io-wall-ok
/**
 * Cloudflare DNS upsert helpers for EMQX Railway provisioning.
 */
import { assert } from '@pkgs/assert';

const CF_API = 'https://api.cloudflare.com/client/v4';

function cfHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env['CLOUDFLARE_API_TOKEN'] ?? ''}`,
    'Content-Type': 'application/json',
  };
}

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
  const res = await fetch(url, { headers });
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
    const res = await fetch(
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

  const res = await fetch(`${CF_API}/zones/${options.zoneId}/dns_records`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  assert.ok(res.ok, `CF DNS create failed: HTTP ${String(res.status)}`);
}

export function cfHeadersForZones(): Record<string, string> {
  return cfHeaders();
}
