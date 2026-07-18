import { assert } from '@pkgs/assert';
import { fetchWithRetry } from '@pkgs/async/fetch-with-retry';

const CF_API = 'https://api.cloudflare.com/client/v4';

export function r2S3Endpoint(accountId: string): string {
  const id = accountId.trim();
  assert.ok(id.length > 0, 'Cloudflare account ID is required for R2 endpoint');
  return `https://${id}.r2.cloudflarestorage.com`;
}

export type EnsureR2BucketResult = 'created' | 'exists';

/**
 * Idempotently create an R2 bucket via the Cloudflare REST API.
 * Runtime code must keep using the S3-compatible endpoint — not this API.
 */
export async function ensureR2Bucket(
  accountId: string,
  bucketName: string,
  headers: Record<string, string>
): Promise<EnsureR2BucketResult> {
  const name = bucketName.trim();
  assert.ok(name.length > 0, 'R2 bucket name must be non-empty');
  const account = accountId.trim();
  assert.ok(account.length > 0, 'Cloudflare account ID is required');

  const existing = await fetchWithRetry(
    `${CF_API}/accounts/${account}/r2/buckets/${encodeURIComponent(name)}`,
    { headers }
  );
  if (existing.ok) {
    return 'exists';
  }
  if (existing.status !== 404) {
    const body = await existing.text();
    throw new Error(
      `R2 bucket lookup failed for ${name}: HTTP ${String(existing.status)}: ${body}`
    );
  }

  const create = await fetchWithRetry(
    `${CF_API}/accounts/${account}/r2/buckets`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    }
  );
  if (!create.ok) {
    const body = await create.text();
    throw new Error(
      `R2 bucket create failed for ${name}: HTTP ${String(create.status)}: ${body}`
    );
  }
  return 'created';
}
