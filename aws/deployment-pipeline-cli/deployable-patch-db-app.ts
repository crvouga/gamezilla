import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { requireOutput, type StackOutputs } from './cdk-outputs';
import type { Deployable } from './deployable';
import { ghNotice } from './gh';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

export class PatchDbAppDeployable implements Deployable {
  readonly id = 'patch-db-app';

  deploy(outputs: StackOutputs): void {
    const bucket = requireOutput(outputs, 'PatchDbAppBucketName');
    const distId = requireOutput(outputs, 'PatchDbAppDistributionId');
    assert(bucket.length > 0 && distId.length > 0);

    run('bun', ['run', 'patch-db-app:build'], { cwd: REPO_ROOT });
    run('aws', ['s3', 'sync', 'dist/', `s3://${bucket}/`, '--delete'], {
      cwd: REPO_ROOT,
    });
    run(
      'aws',
      [
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        distId,
        '--paths',
        '/*',
      ],
      { cwd: REPO_ROOT }
    );

    rmSync(join(REPO_ROOT, 'dist'), { recursive: true, force: true });
    ghNotice('PatchDB app built and synced to S3.');
  }
}
