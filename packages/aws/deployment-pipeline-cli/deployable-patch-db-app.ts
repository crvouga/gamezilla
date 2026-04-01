import { assert } from '@gamezilla/shared/assert';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { requireOutput, type StackOutputs } from './cdk-outputs';
import { CiPlatform } from './ci-platform';
import type { Deployable } from './deployable';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

export class PatchDbAppDeployable implements Deployable {
  readonly id = 'patch-db-app';

  constructor(protected readonly platform: CiPlatform) {}

  deploy(outputs: StackOutputs): void {
    const bucket = requireOutput(
      this.platform,
      outputs,
      'PatchDbAppBucketName'
    );
    const distId = requireOutput(
      this.platform,
      outputs,
      'PatchDbAppDistributionId'
    );
    assert.ok(
      bucket.length > 0 && distId.length > 0,
      'deploy: bucket and distId must be non-empty'
    );

    run(this.platform, 'bun', ['run', '--filter', '@gamezilla/patch-db-app', 'build'], {
      cwd: REPO_ROOT,
    });
    run(
      this.platform,
      'aws',
      [
        's3', 'sync', 'packages/patch-db-app/dist/', `s3://${bucket}/`,
        '--delete', '--exclude', '*.wasm',
      ],
      { cwd: REPO_ROOT }
    );
    run(
      this.platform,
      'aws',
      [
        's3', 'sync', 'packages/patch-db-app/dist/', `s3://${bucket}/`,
        '--exclude', '*', '--include', '*.wasm',
        '--content-type', 'application/wasm',
      ],
      { cwd: REPO_ROOT }
    );
    run(
      this.platform,
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
    this.platform.notice('PatchDB app built and synced to S3.');
  }
}
