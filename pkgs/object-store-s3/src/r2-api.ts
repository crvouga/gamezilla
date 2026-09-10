/**
 * Cloudflare R2 helpers for infra provision:
 * ensure buckets → mint per-bucket S3-compatible API tokens.
 */
import { createHash } from 'node:crypto';
import { assert } from '@pkgs/assert';
import { fetchWithRetry } from '@pkgs/async/fetch-with-retry';
import { cliHttp, cliTimers } from './cli-io';

const CF_API = 'https://api.cloudflare.com/client/v4';

/** Stable permission-group id for Object Read & Write on a single R2 bucket. */
const R2_BUCKET_ITEM_WRITE_PERMISSION_ID = '2efd5506f9c8494dacb1fa10a3e7d5b6';

export const R2_S3_REGION = 'auto' as const;

export type R2S3Credentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

export function r2S3Endpoint(accountId: string): string {
  const id = accountId.trim();
  assert.ok(id.length > 0, 'CLOUDFLARE_ACCOUNT_ID required');
  return `https://${id}.r2.cloudflarestorage.com`;
}

function cfHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

type CfEnvelope<T> = {
  readonly success?: boolean;
  readonly errors?: ReadonlyArray<{
    readonly code?: number;
    readonly message?: string;
  }>;
  readonly result?: T;
};

async function readCfJson<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  let body: CfEnvelope<T>;
  try {
    body = JSON.parse(text) as CfEnvelope<T>;
  } catch {
    throw new Error(`${label}: HTTP ${String(res.status)}: ${text}`);
  }
  if (!res.ok || body.success === false) {
    const detail =
      body.errors
        ?.map((e) => `${String(e.code ?? '?')}: ${e.message ?? ''}`)
        .join('; ') || text;
    throw new Error(`${label}: HTTP ${String(res.status)}: ${detail}`);
  }
  assert.ok(body.result !== undefined, `${label}: missing result`);
  return body.result;
}

function isAlreadyExistsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('already exists') ||
    msg.includes('10004') ||
    msg.includes('409')
  );
}

export async function ensureR2Bucket(
  accountId: string,
  apiToken: string,
  bucketName: string
): Promise<void> {
  const id = accountId.trim();
  const token = apiToken.trim();
  const name = bucketName.trim();
  assert.ok(id.length > 0, 'CLOUDFLARE_ACCOUNT_ID required');
  assert.ok(token.length > 0, 'CLOUDFLARE_API_TOKEN required');
  assert.ok(name.length > 0, 'R2 bucket name must be non-empty');

  try {
    const res = await fetchWithRetry(
      `${CF_API}/accounts/${id}/r2/buckets`,
      {
        method: 'POST',
        headers: cfHeaders(token),
        body: JSON.stringify({ name }),
      },
      { fetch: cliHttp.fetch, timers: cliTimers }
    );
    await readCfJson<{ name?: string }>(res, `r2_create_bucket(${name})`);
  } catch (e) {
    if (isAlreadyExistsError(e)) return;
    throw e;
  }
}

type TokenRow = {
  readonly id: string;
  readonly name?: string;
};

async function listAccountTokens(
  accountId: string,
  apiToken: string
): Promise<TokenRow[]> {
  const tokens: TokenRow[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchWithRetry(
      `${CF_API}/accounts/${accountId}/tokens?page=${String(page)}&per_page=50`,
      { headers: cfHeaders(apiToken) },
      { fetch: cliHttp.fetch, timers: cliTimers }
    );
    const result = await readCfJson<TokenRow[] | { tokens?: TokenRow[] }>(
      res,
      'r2_list_account_tokens'
    );
    const batch = Array.isArray(result) ? result : (result.tokens ?? []);
    tokens.push(...batch);
    if (batch.length < 50) break;
    page += 1;
  }
  return tokens;
}

async function deleteAccountTokensNamed(
  accountId: string,
  apiToken: string,
  tokenName: string
): Promise<void> {
  const tokens = await listAccountTokens(accountId, apiToken);
  for (const row of tokens) {
    if (row.name !== tokenName) continue;
    const res = await fetchWithRetry(
      `${CF_API}/accounts/${accountId}/tokens/${row.id}`,
      {
        method: 'DELETE',
        headers: cfHeaders(apiToken),
      },
      { fetch: cliHttp.fetch, timers: cliTimers }
    );
    if (!res.ok && res.status !== 404) {
      await readCfJson(res, `r2_delete_account_token(${tokenName})`);
    }
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Mint S3-compatible Access Key ID / Secret Access Key for one R2 bucket.
 * Access Key ID = Cloudflare API token id; Secret = SHA-256 of token value.
 */
export async function mintR2S3Credentials(options: {
  readonly accountId: string;
  readonly apiToken: string;
  readonly bucket: string;
  readonly tokenName: string;
}): Promise<R2S3Credentials> {
  const accountId = options.accountId.trim();
  const apiToken = options.apiToken.trim();
  const bucket = options.bucket.trim();
  const tokenName = options.tokenName.trim();
  assert.ok(accountId.length > 0, 'CLOUDFLARE_ACCOUNT_ID required');
  assert.ok(apiToken.length > 0, 'CLOUDFLARE_API_TOKEN required');
  assert.ok(bucket.length > 0, 'bucket required');
  assert.ok(tokenName.length > 0, 'tokenName required');

  await deleteAccountTokensNamed(accountId, apiToken, tokenName);

  const resourceKey = `com.cloudflare.edge.r2.bucket.${accountId}_default_${bucket}`;
  let res: Response;
  try {
    res = await fetchWithRetry(
      `${CF_API}/accounts/${accountId}/tokens`,
      {
        method: 'POST',
        headers: cfHeaders(apiToken),
        body: JSON.stringify({
          name: tokenName,
          policies: [
            {
              effect: 'allow',
              resources: { [resourceKey]: '*' },
              permission_groups: [
                {
                  id: R2_BUCKET_ITEM_WRITE_PERMISSION_ID,
                  name: 'Workers R2 Storage Bucket Item Write',
                },
              ],
            },
          ],
        }),
      },
      { fetch: cliHttp.fetch, timers: cliTimers }
    );
  } catch (e) {
    throw new Error(
      [
        `Failed to mint R2 S3 credentials for bucket ${bucket}:`,
        e instanceof Error ? e.message : String(e),
        '',
        'CLOUDFLARE_API_TOKEN needs Account API Tokens Edit (to create tokens)',
        'and Workers R2 Storage Edit (to manage buckets).',
        'https://dash.cloudflare.com/profile/api-tokens',
      ].join('\n')
    );
  }

  let body: { id?: string; value?: string };
  try {
    body = await readCfJson<{ id?: string; value?: string }>(
      res,
      `r2_create_account_token(${tokenName})`
    );
  } catch (e) {
    throw new Error(
      [
        `Failed to mint R2 S3 credentials for bucket ${bucket}:`,
        e instanceof Error ? e.message : String(e),
        '',
        'CLOUDFLARE_API_TOKEN needs Account API Tokens Edit (to create tokens)',
        'and Workers R2 Storage Edit (to manage buckets).',
        'https://dash.cloudflare.com/profile/api-tokens',
      ].join('\n')
    );
  }

  assert.ok(
    typeof body.id === 'string' &&
      body.id.length > 0 &&
      typeof body.value === 'string' &&
      body.value.length > 0,
    `r2_create_account_token(${tokenName}) missing id/value`
  );

  return {
    accessKeyId: body.id,
    secretAccessKey: sha256Hex(body.value),
  };
}

export function resolveR2ProvisionAuth(secrets?: ReadonlyMap<string, string>): {
  readonly accountId: string;
  readonly apiToken: string;
} {
  const accountId =
    secrets?.get('CLOUDFLARE_ACCOUNT_ID')?.trim() ||
    (process.env['CLOUDFLARE_ACCOUNT_ID'] ?? '').trim();
  const apiToken =
    secrets?.get('CLOUDFLARE_API_TOKEN')?.trim() ||
    (process.env['CLOUDFLARE_API_TOKEN'] ?? '').trim();
  assert.ok(accountId.length > 0, 'CLOUDFLARE_ACCOUNT_ID required');
  assert.ok(apiToken.length > 0, 'CLOUDFLARE_API_TOKEN required');
  return { accountId, apiToken };
}
