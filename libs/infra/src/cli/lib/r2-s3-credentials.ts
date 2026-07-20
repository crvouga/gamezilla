import { createHash } from 'node:crypto';

import { assert } from '@pkgs/assert';
import { fetchWithRetry } from '@pkgs/async/fetch-with-retry';

const CF_API = 'https://api.cloudflare.com/client/v4';

/**
 * Cloudflare permission group id for "Workers R2 Storage Bucket Item Write"
 * (documented in https://developers.cloudflare.com/r2/api/tokens/).
 */
const R2_BUCKET_ITEM_WRITE_PERMISSION_ID = '2efd5506f9c8494dacb1fa10a3e7d5b6';

export type R2S3Credentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

type TokenCreateResult = {
  readonly id: string;
  readonly value: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function bucketResourceKey(accountId: string, bucketName: string): string {
  return `com.cloudflare.edge.r2.bucket.${accountId}_default_${bucketName}`;
}

/**
 * Mint S3-compatible Access Key ID / Secret Access Key for one R2 bucket.
 * Access Key ID = token id; Secret Access Key = SHA-256(token value).
 */
export async function mintR2S3Credentials(options: {
  readonly accountId: string;
  readonly bucketName: string;
  readonly tokenName: string;
  readonly headers: Record<string, string>;
}): Promise<R2S3Credentials> {
  const accountId = options.accountId.trim();
  const bucketName = options.bucketName.trim();
  assert.ok(accountId.length > 0, 'accountId required');
  assert.ok(bucketName.length > 0, 'bucketName required');

  const res = await fetchWithRetry(`${CF_API}/accounts/${accountId}/tokens`, {
    method: 'POST',
    headers: options.headers,
    body: JSON.stringify({
      name: options.tokenName,
      policies: [
        {
          effect: 'allow',
          resources: {
            [bucketResourceKey(accountId, bucketName)]: '*',
          },
          permission_groups: [{ id: R2_BUCKET_ITEM_WRITE_PERMISSION_ID }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const r2TokensUrl = `https://dash.cloudflare.com/${accountId}/r2/api-tokens`;
    const profileTokensUrl = 'https://dash.cloudflare.com/profile/api-tokens';
    throw new Error(
      [
        `Failed to mint R2 S3 credentials for ${bucketName} (HTTP ${String(res.status)}): ${body}`,
        '',
        'Fix one of:',
        `  1. Create an R2 Object Read & Write API token (scoped to this bucket), then set`,
        '     S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY in the secret store (`bun run infra setup`):',
        `     ${r2TokensUrl}`,
        `  2. Or grant CLOUDFLARE_API_TOKEN "Create Additional Tokens" so provision can mint keys:`,
        `     ${profileTokensUrl}`,
      ].join('\n')
    );
  }

  const json = (await res.json()) as { result?: TokenCreateResult };
  const result = json.result;
  assert.ok(
    result !== undefined &&
      typeof result.id === 'string' &&
      result.id.length > 0 &&
      typeof result.value === 'string' &&
      result.value.length > 0,
    'Cloudflare token create response missing id/value'
  );

  return {
    accessKeyId: result.id,
    secretAccessKey: sha256Hex(result.value),
  };
}
