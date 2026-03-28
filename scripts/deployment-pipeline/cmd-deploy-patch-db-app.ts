import assert from 'node:assert/strict';
import { BasePipelineCommand } from './base-command';
import { ghNotice, mustEnv } from './gh';
import { run } from './run-subprocess';

export class DeployPatchDbAppCommand extends BasePipelineCommand {
  readonly id = 'deploy-patch-db-app';
  readonly summary = 'PatchDB build + S3 + invalidation';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const bucket = mustEnv(
      process.env['PATCH_DB_APP_BUCKET'],
      'PATCH_DB_APP_BUCKET'
    );
    const distId = mustEnv(
      process.env['PATCH_DB_APP_DIST'],
      'PATCH_DB_APP_DIST'
    );
    assert(bucket.length > 0 && distId.length > 0);

    run('bun', ['run', 'patch-db-app:build']);
    run('aws', ['s3', 'sync', 'dist/', `s3://${bucket}/`, '--delete']);
    run('aws', [
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      distId,
      '--paths',
      '/*',
    ]);
    ghNotice('PatchDB app built and synced to S3.');
  }
}
