import { ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { ResourceBase, type InfraContext } from './types';

/**
 * Backblaze B2 bucket for object storage. Externally managed (like PlanetScale
 * Postgres) — operators create the bucket and application key in the Backblaze
 * console, then store credentials in Vault. Provision only verifies the
 * secrets are present after {@link VaultResource} loads them.
 */
export class B2BucketResource extends ResourceBase {
  readonly id = 'b2-buckets';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const bucket = (process.env['B2_BUCKET_NAME'] ?? '').trim();
    if (bucket.length === 0) {
      throw new Error(
        'B2_BUCKET_NAME is missing from Vault — create a Backblaze B2 bucket and store B2_* secrets before deploying'
      );
    }
    ok('B2 bucket', `${bucket} (externally managed)`);
  }

  async destroy(): Promise<void> {
    ok('B2 bucket', 'manually managed — skipping');
  }
}
