import { ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { ResourceBase, type InfraContext } from './types';

/**
 * S3-compatible object storage bucket. Externally managed (like Postgres
 * Postgres) — operators create the bucket and credentials in their provider
 * console, then store secrets in the secret store. Provision only verifies the secrets
 * are present after {@link VaultResource} loads them.
 */
export class S3BucketResource extends ResourceBase {
  readonly id = 's3-bucket';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const bucket = (process.env['S3_BUCKET'] ?? '').trim();
    if (bucket.length === 0) {
      throw new Error(
        'S3_BUCKET is missing from the secret store — create an S3-compatible bucket and store S3_* secrets before deploying'
      );
    }
    ok('S3 bucket', `${bucket} (externally managed)`);
  }

  async destroy(): Promise<void> {
    ok('S3 bucket', 'manually managed — skipping');
  }
}
