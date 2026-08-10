/**
 * Backblaze B2 native API helpers for infra provision:
 * authorize → ensure buckets → mint per-bucket S3 application keys.
 */
import { assert } from '@pkgs/assert';
import { fetchWithRetry } from '@pkgs/async/fetch-with-retry';
import { cliIo } from './cli-io';

const B2_AUTH_URL = 'https://api.backblazeb2.com/b2api/v4/b2_authorize_account';

const BUCKET_KEY_CAPABILITIES = [
  'listBuckets',
  'readBuckets',
  'listFiles',
  'readFiles',
  'writeFiles',
  'deleteFiles',
] as const;

export const B2_PROVISION_CAPABILITIES = [
  'writeBuckets',
  'listBuckets',
  'readBuckets',
  'writeKeys',
  'listKeys',
  'deleteKeys',
] as const;

export type B2Auth = {
  readonly accountId: string;
  readonly apiUrl: string;
  readonly s3ApiUrl: string;
  readonly authToken: string;
  readonly capabilities: readonly string[];
};

export type B2S3Credentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

type AuthCacheEntry = { readonly key: string; readonly auth: Promise<B2Auth> };
let authCache: AuthCacheEntry | null = null;

function basicAuthHeader(keyId: string, applicationKey: string): string {
  return `Basic ${Buffer.from(`${keyId}:${applicationKey}`, 'utf8').toString('base64')}`;
}

function authHeaders(auth: B2Auth): Record<string, string> {
  return {
    Authorization: auth.authToken,
    'Content-Type': 'application/json',
  };
}

async function readB2Json<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label}: HTTP ${String(res.status)}: ${body}`);
  }
  return (await res.json()) as T;
}

export function b2S3Region(s3ApiUrl: string): string {
  const host = new URL(s3ApiUrl.trim()).hostname;
  const match = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i.exec(host);
  assert.ok(
    match !== null && match[1] !== undefined,
    `Unexpected B2 S3 API URL: ${s3ApiUrl}`
  );
  return match[1];
}

type AuthorizeBody = {
  readonly accountId?: string;
  readonly authorizationToken?: string;
  readonly apiInfo?: {
    readonly storageApi?: {
      readonly apiUrl?: string;
      readonly s3ApiUrl?: string;
      /** Older authorize responses nested capabilities here. */
      readonly capabilities?: readonly string[];
      /** Current authorize responses nest capabilities under `allowed`. */
      readonly allowed?: {
        readonly capabilities?: readonly string[];
      };
    };
  };
};

function storageCapabilities(
  storage: NonNullable<NonNullable<AuthorizeBody['apiInfo']>['storageApi']>
): readonly string[] {
  const fromAllowed = storage.allowed?.capabilities;
  if (fromAllowed !== undefined && fromAllowed.length > 0) {
    return fromAllowed;
  }
  return storage.capabilities ?? [];
}

function parseAuthorizeBody(body: AuthorizeBody): B2Auth {
  const storage = body.apiInfo?.storageApi;
  const accountId = body.accountId?.trim() ?? '';
  const authToken = body.authorizationToken?.trim() ?? '';
  const apiUrl = storage?.apiUrl?.trim() ?? '';
  const s3ApiUrl = storage?.s3ApiUrl?.trim() ?? '';
  assert.ok(accountId.length > 0, 'B2 authorize missing accountId');
  assert.ok(authToken.length > 0, 'B2 authorize missing authorizationToken');
  assert.ok(apiUrl.length > 0, 'B2 authorize missing apiUrl');
  assert.ok(s3ApiUrl.length > 0, 'B2 authorize missing s3ApiUrl');
  return {
    accountId,
    apiUrl,
    s3ApiUrl,
    authToken,
    capabilities: storage !== undefined ? storageCapabilities(storage) : [],
  };
}

export function authorizeB2(
  keyId: string,
  applicationKey: string
): Promise<B2Auth> {
  const id = keyId.trim();
  const key = applicationKey.trim();
  assert.ok(id.length > 0, 'B2_MASTER_KEY_ID required');
  assert.ok(key.length > 0, 'B2_MASTER_KEY required');
  const cacheKey = `${id}\0${key}`;
  if (authCache?.key === cacheKey) return authCache.auth;
  const auth = (async (): Promise<B2Auth> => {
    const res = await fetchWithRetry(
      B2_AUTH_URL,
      {
        headers: { Authorization: basicAuthHeader(id, key) },
      },
      { fetch: cliIo.http.fetch, timers: cliIo.timers }
    );
    const body = await readB2Json<AuthorizeBody>(res, 'b2_authorize_account');
    return parseAuthorizeBody(body);
  })();
  authCache = { key: cacheKey, auth };
  return auth;
}

export function clearB2AuthCache(): void {
  authCache = null;
}

export async function authorizeB2FromEnv(
  secrets?: ReadonlyMap<string, string>
): Promise<B2Auth> {
  const keyId =
    secrets?.get('B2_MASTER_KEY_ID')?.trim() ||
    (process.env['B2_MASTER_KEY_ID'] ?? '').trim();
  const masterKey =
    secrets?.get('B2_MASTER_KEY')?.trim() ||
    (process.env['B2_MASTER_KEY'] ?? '').trim();
  return authorizeB2(keyId, masterKey);
}

type BucketRow = {
  readonly bucketId: string;
  readonly bucketName: string;
};

async function listBucketByName(
  auth: B2Auth,
  bucketName: string
): Promise<BucketRow | null> {
  const res = await fetchWithRetry(
    `${auth.apiUrl}/b2api/v4/b2_list_buckets`,
    {
      method: 'POST',
      headers: authHeaders(auth),
      body: JSON.stringify({
        accountId: auth.accountId,
        bucketName,
      }),
    },
    { fetch: cliIo.http.fetch, timers: cliIo.timers }
  );
  const body = await readB2Json<{ buckets?: BucketRow[] }>(
    res,
    `b2_list_buckets(${bucketName})`
  );
  const match = (body.buckets ?? []).find((b) => b.bucketName === bucketName);
  return match ?? null;
}

export async function ensureB2Bucket(
  auth: B2Auth,
  bucketName: string
): Promise<string> {
  const name = bucketName.trim();
  assert.ok(name.length > 0, 'B2 bucket name must be non-empty');
  const existing = await listBucketByName(auth, name);
  if (existing !== null) return existing.bucketId;

  const res = await fetchWithRetry(
    `${auth.apiUrl}/b2api/v4/b2_create_bucket`,
    {
      method: 'POST',
      headers: authHeaders(auth),
      body: JSON.stringify({
        accountId: auth.accountId,
        bucketName: name,
        bucketType: 'allPrivate',
      }),
    },
    { fetch: cliIo.http.fetch, timers: cliIo.timers }
  );
  const body = await readB2Json<{ bucketId?: string }>(
    res,
    `b2_create_bucket(${name})`
  );
  assert.ok(
    typeof body.bucketId === 'string' && body.bucketId.length > 0,
    `b2_create_bucket(${name}) missing bucketId`
  );
  return body.bucketId;
}

type KeyRow = {
  readonly applicationKeyId: string;
  readonly keyName: string;
};

async function listAllKeys(auth: B2Auth): Promise<KeyRow[]> {
  const keys: KeyRow[] = [];
  let nextApplicationKeyId: string | undefined;
  for (;;) {
    const res = await fetchWithRetry(
      `${auth.apiUrl}/b2api/v4/b2_list_keys`,
      {
        method: 'POST',
        headers: authHeaders(auth),
        body: JSON.stringify({
          accountId: auth.accountId,
          ...(nextApplicationKeyId !== undefined
            ? { startApplicationKeyId: nextApplicationKeyId }
            : {}),
        }),
      },
      { fetch: cliIo.http.fetch, timers: cliIo.timers }
    );
    const body = await readB2Json<{
      keys?: KeyRow[];
      nextApplicationKeyId?: string | null;
    }>(res, 'b2_list_keys');
    keys.push(...(body.keys ?? []));
    if (
      body.nextApplicationKeyId === undefined ||
      body.nextApplicationKeyId === null
    ) {
      break;
    }
    nextApplicationKeyId = body.nextApplicationKeyId;
  }
  return keys;
}

async function deleteKeysNamed(auth: B2Auth, keyName: string): Promise<void> {
  const keys = await listAllKeys(auth);
  for (const key of keys) {
    if (key.keyName !== keyName) continue;
    const res = await fetchWithRetry(
      `${auth.apiUrl}/b2api/v4/b2_delete_key`,
      {
        method: 'POST',
        headers: authHeaders(auth),
        body: JSON.stringify({ applicationKeyId: key.applicationKeyId }),
      },
      { fetch: cliIo.http.fetch, timers: cliIo.timers }
    );
    await readB2Json(res, `b2_delete_key(${keyName})`);
  }
}

export async function mintB2S3Credentials(options: {
  readonly auth: B2Auth;
  readonly bucketId: string;
  readonly keyName: string;
}): Promise<B2S3Credentials> {
  const bucketId = options.bucketId.trim();
  const keyName = options.keyName.trim();
  assert.ok(bucketId.length > 0, 'bucketId required');
  assert.ok(keyName.length > 0, 'keyName required');

  await deleteKeysNamed(options.auth, keyName);

  const res = await fetchWithRetry(
    `${options.auth.apiUrl}/b2api/v4/b2_create_key`,
    {
      method: 'POST',
      headers: authHeaders(options.auth),
      body: JSON.stringify({
        accountId: options.auth.accountId,
        capabilities: [...BUCKET_KEY_CAPABILITIES],
        keyName,
        bucketIds: [bucketId],
      }),
    },
    { fetch: cliIo.http.fetch, timers: cliIo.timers }
  );
  const body = await readB2Json<{
    applicationKeyId?: string;
    applicationKey?: string;
  }>(res, `b2_create_key(${keyName})`);
  assert.ok(
    typeof body.applicationKeyId === 'string' &&
      body.applicationKeyId.length > 0 &&
      typeof body.applicationKey === 'string' &&
      body.applicationKey.length > 0,
    `b2_create_key(${keyName}) missing applicationKeyId/applicationKey`
  );
  return {
    accessKeyId: body.applicationKeyId,
    secretAccessKey: body.applicationKey,
  };
}
