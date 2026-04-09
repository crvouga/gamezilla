import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import type { CiPlatform } from '../platform/platform';
import type { Resource } from './types';

const BUCKET_NAMES: readonly string[] = [
  PROJECT_CONFIG.cloudflare.turboCacheBucket,
];

interface R2ListResponse {
  success: boolean;
  result?: { objects?: Array<{ key: string }> };
  result_info?: { cursor?: string };
}

/**
 * Empty all R2 buckets tracked by Terraform so `terraform destroy` can
 * delete them cleanly. Cloudflare's API refuses to delete non-empty buckets.
 */
export class R2BucketsResource implements Resource {
  readonly id = 'r2-buckets';

  async destroy(platform: CiPlatform): Promise<void> {
    const accountId = cfAccountId();
    const headers = cfHeaders();

    for (const bucket of BUCKET_NAMES) {
      await emptyBucket(platform, accountId, headers, bucket);
    }
  }
}

async function emptyBucket(
  platform: CiPlatform,
  accountId: string,
  headers: Record<string, string>,
  bucket: string,
): Promise<void> {
  let totalDeleted = 0;
  let cursor: string | undefined;

  for (;;) {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects`,
    );
    url.searchParams.set('per_page', '500');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.href, {
      headers: { ...headers, 'cf-r2-jurisdiction': 'default' },
    });

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
    const objects = body.result?.objects ?? [];
    if (objects.length === 0) break;

    const keys = objects.map((o) => o.key);
    const delRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/delete`,
      {
        method: 'POST',
        headers: { ...headers, 'cf-r2-jurisdiction': 'default' },
        body: JSON.stringify({ keys }),
      },
    );

    if (!delRes.ok) {
      const text = await delRes.text();
      warn(`R2 ${bucket}`, `bulk delete failed: HTTP ${delRes.status} — ${text}`);
      return;
    }

    totalDeleted += keys.length;
    platform.notice(`R2 ${bucket}: deleted ${keys.length} objects (${totalDeleted} total)`);

    cursor = body.result_info?.cursor;
    if (!cursor) break;
  }

  if (totalDeleted > 0) {
    ok(`R2 ${bucket}`, `emptied (${totalDeleted} objects deleted)`);
  } else {
    ok(`R2 ${bucket}`, 'already empty');
  }
}
