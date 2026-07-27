import { ok } from '../lib/fmt';
import { ensureObjectStoreBuckets } from '../lib/s3-secret-seed';
import type { CiPlatform } from '../platform/platform';
import { ResourceBase, type InfraContext } from './types';

/**
 * Ensures Backblaze B2 buckets exist. B2_APP_* / S3_* secret-store credentials
 * are seeded by {@link SecretsResource} via each secret's `seed()`.
 */
export class S3BucketResource extends ResourceBase {
  readonly id = 's3-bucket';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await ensureObjectStoreBuckets();
    ok('B2 buckets', 'ensured (dev + prd)');
  }

  async destroy(): Promise<void> {
    ok('S3 bucket', 'B2 buckets retained — skipping delete');
  }
}
