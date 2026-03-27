import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BasePipelineCommand } from './base-command';
import { ghError, ghNotice, mustEnv } from './gh';
import { run } from './run-subprocess';

export class DeployWebCommand extends BasePipelineCommand {
  readonly id = 'deploy-web';
  readonly summary = 'Expo export + S3 + invalidation';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const syncUrl = mustEnv(process.env['SYNC_URL'], 'SYNC_URL');
    const bucket = mustEnv(process.env['WEB_BUCKET'], 'WEB_BUCKET');
    const distId = mustEnv(process.env['WEB_DIST'], 'WEB_DIST');
    assert(bucket.length > 0 && distId.length > 0);

    if (!/^https:\/\//.test(syncUrl)) {
      ghError(`prod PATCH_DB_SYNC_SERVER_URL must be https:// (got: ${syncUrl})`);
      assert.fail('deploy-web: sync URL must be https://');
    }
    assert(/^https:\/\//.test(syncUrl));

    const configPath = join(process.cwd(), 'public-config.json');
    assert(configPath.length > 0);
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (e) {
      ghError(`public-config.json: ${String(e)}`);
      assert.fail('deploy-web: public-config.json must be valid JSON');
    }
    if (
      typeof doc !== 'object' ||
      doc === null ||
      !('prod' in doc) ||
      typeof (doc as { prod?: unknown }).prod !== 'object' ||
      (doc as { prod: unknown }).prod === null
    ) {
      ghError('public-config.json missing prod object');
      assert.fail('deploy-web: public-config.json must contain prod object');
    }
    const o = doc as { local: unknown; prod: Record<string, unknown> };
    o.prod['PATCH_DB_SYNC_SERVER_URL'] = syncUrl;
    assert.strictEqual(o.prod['PATCH_DB_SYNC_SERVER_URL'], syncUrl);
    writeFileSync(
      configPath,
      `${JSON.stringify(o, null, 2)}\n`,
      'utf8'
    );

    run('bunx', ['expo', 'export', '-p', 'web'], {
      env: { ...process.env, EXPO_PUBLIC_STAGE: 'prod' },
    });

    run('aws', ['s3', 'sync', 'dist/', `s3://${bucket}/`, '--delete']);
    run('aws', [
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      distId,
      '--paths',
      '/*',
    ]);

    rmSync(join(process.cwd(), 'dist'), { recursive: true, force: true });
    ghNotice('Web app exported and synced to S3.');
  }
}
