import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { requireOutput, type StackOutputs } from './cdk-outputs';
import { reportNotice } from './ci-platform';
import type { Deployable } from './deployable';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

export class PatchDbAppDeployable implements Deployable {
  readonly id = 'patch-db-app';

  deploy(outputs: StackOutputs): void {
    const bucket = requireOutput(outputs, 'PatchDbAppBucketName');
    const distId = requireOutput(outputs, 'PatchDbAppDistributionId');
    assert(bucket.length > 0 && distId.length > 0);

    run('bun', ['run', '--filter', 'patch-db-app', 'build'], {
      cwd: REPO_ROOT,
    });
    run(
      'aws',
      [
        's3',
        'sync',
        'packages/patch-db-app/dist/',
        `s3://${bucket}/`,
        '--delete',
      ],
      {
        cwd: REPO_ROOT,
      }
    );
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

    rmSync(join(REPO_ROOT, 'packages/patch-db-app/dist'), {
      recursive: true,
      force: true,
    });
    reportNotice('PatchDB app built and synced to S3.');
  }
}
