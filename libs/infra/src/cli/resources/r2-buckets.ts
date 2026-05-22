import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import {
  ResourceBase,
  type InfraContext,
  type ResourceRoutineStatus,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const BUCKET_LOCATION = 'ENAM';

interface R2Object {
  key: string;
}

interface R2ListResponse {
  success: boolean;
  result?: R2Object[] | null;
  result_info?: { cursor?: string };
}

function r2Headers(): Record<string, string> {
  return { ...cfHeaders(), 'cf-r2-jurisdiction': 'default' };
}

/**
 * One R2 bucket = one resource. Every bucket subclass picks its own
 * `id` + `bucketName` (and optionally flips `routineStatus` to
 * `'destroyed'`); the lifecycle methods themselves are identical, so
 * they live on the base class.
 */
abstract class R2BucketResourceBase extends ResourceBase {
  abstract readonly bucketName: string;

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const accountId = cfAccountId();
    const headers = r2Headers();
    const bucket = this.bucketName;

    const res = await fetch(
      `${CF_API}/accounts/${accountId}/r2/buckets/${bucket}`,
      { headers }
    );

    if (res.ok) {
      ok(`R2 ${bucket}`, 'exists');
      return;
    }

    if (res.status !== 404) {
      const text = await res.text();
      throw new Error(
        `R2 ${bucket}: lookup failed: HTTP ${res.status} — ${text}`
      );
    }

    const create = await fetch(`${CF_API}/accounts/${accountId}/r2/buckets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: bucket, locationHint: BUCKET_LOCATION }),
    });

    if (!create.ok) {
      const text = await create.text();
      throw new Error(
        `R2 ${bucket}: create failed: HTTP ${create.status} — ${text}`
      );
    }

    ok(`R2 ${bucket}`, 'created');
  }

  /** Idempotent: empty the bucket, then delete it. 404 at any step is
   * success — the `'destroyed'`-resource tail phase of `infra deploy`
   * reruns this on every deploy, so it must converge on already-absent
   * buckets. */
  async destroy(platform: CiPlatform): Promise<void> {
    const accountId = cfAccountId();
    const headers = r2Headers();
    await emptyBucket(platform, accountId, headers, this.bucketName);
    await deleteBucket(accountId, headers, this.bucketName);
  }
}

/** `'created'`: backs the TTS audio cache binding in `apps/api/wrangler.toml`. */
export class TtsAudioBucketResource extends R2BucketResourceBase {
  readonly id = 'r2-bucket-tts-audio';
  readonly bucketName = PROJECT_CONFIG.cloudflare.ttsAudioBucket;
}

/**
 * `'destroyed'`: backed the self-hosted Turborepo remote cache Worker
 * (`apps/turbo-cache`). The resource stays in the registry so
 * `infra deploy`'s `'destroyed'`-resource tail phase keeps the bucket
 * gone, and so flipping `routineStatus` to `'created'` is the only
 * thing needed to recreate it alongside its consumer Worker.
 */
export class TurboCacheBucketResource extends R2BucketResourceBase {
  readonly id = 'r2-bucket-turbo-cache';
  readonly bucketName = PROJECT_CONFIG.cloudflare.turboCacheBucket;
  override readonly routineStatus: ResourceRoutineStatus = 'destroyed';
}

async function emptyBucket(
  platform: CiPlatform,
  accountId: string,
  headers: Record<string, string>,
  bucket: string
): Promise<void> {
  let totalDeleted = 0;
  let cursor: string | undefined;

  for (;;) {
    const url = new URL(
      `${CF_API}/accounts/${accountId}/r2/buckets/${bucket}/objects`
    );
    url.searchParams.set('per_page', '500');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.href, { headers });

    if (res.status === 404) {
      ok(`R2 ${bucket}`, 'not found — nothing to empty');
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      warn(`R2 ${bucket}`, `list failed: HTTP ${res.status} — ${text}`);
      return;
    }

    const body = (await res.json()) as R2ListResponse;
    const objects = body.result ?? [];
    if (objects.length === 0) break;

    for (const obj of objects) {
      const encodedKey = encodeURIComponent(obj.key);
      const delRes = await fetch(
        `${CF_API}/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodedKey}`,
        { method: 'DELETE', headers }
      );

      if (!delRes.ok && delRes.status !== 404) {
        warn(`R2 ${bucket}`, `delete ${obj.key} failed: HTTP ${delRes.status}`);
      }
    }

    totalDeleted += objects.length;
    platform.notice(
      `R2 ${bucket}: deleted ${objects.length} objects (${totalDeleted} total)`
    );

    cursor = body.result_info?.cursor;
    if (!cursor) break;
  }

  if (totalDeleted > 0) {
    ok(`R2 ${bucket}`, `emptied (${totalDeleted} objects deleted)`);
  } else {
    ok(`R2 ${bucket}`, 'already empty');
  }
}

async function deleteBucket(
  accountId: string,
  headers: Record<string, string>,
  bucket: string
): Promise<void> {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/r2/buckets/${bucket}`,
    { method: 'DELETE', headers }
  );

  if (res.status === 404) {
    ok(`R2 ${bucket}`, 'not found — nothing to delete');
    return;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `R2 ${bucket}: delete failed: HTTP ${res.status} — ${text}`
    );
  }

  ok(`R2 ${bucket}`, 'deleted');
}
