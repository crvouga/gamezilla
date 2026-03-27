import assert from 'node:assert/strict';
import { BaseCiCommand } from './base-command';
import { ghNotice, mustEnv } from './gh';
import { run } from './run-subprocess';

export class DeployVizCommand extends BaseCiCommand {
  readonly id = 'deploy-viz';
  readonly summary = 'viz:build + S3 + invalidation';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const bucket = mustEnv(process.env['VIZ_BUCKET'], 'VIZ_BUCKET');
    const distId = mustEnv(process.env['VIZ_DIST'], 'VIZ_DIST');
    assert(bucket.length > 0 && distId.length > 0);

    run('bun', ['run', 'viz:build']);
    run('aws', ['s3', 'sync', 'dist/', `s3://${bucket}/`, '--delete']);
    run('aws', [
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      distId,
      '--paths',
      '/*',
    ]);
    ghNotice('Sim viz built and synced to S3.');
  }
}
