import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireOutput, type StackOutputs } from './cdk-outputs';
import type { Deployable } from './deployable';
import { ghError, ghNotice } from './gh';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

export class WebAppDeployable implements Deployable {
  readonly id = 'web-app';

  deploy(outputs: StackOutputs): void {
    const syncUrl = toHttps(requireOutput(outputs, 'SyncServerUrl'));
    const bucket = requireOutput(outputs, 'WebAppBucketName');
    const distId = requireOutput(outputs, 'WebDistributionId');

    if (!/^https:\/\//.test(syncUrl)) {
      ghError(`PATCH_DB_SYNC_SERVER_URL must be https:// (got: ${syncUrl})`);
      assert.fail('web-app: sync URL must be https://');
    }

    const configPath = join(REPO_ROOT, 'public-config.json');
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (e) {
      ghError(`public-config.json: ${String(e)}`);
      assert.fail('web-app: public-config.json must be valid JSON');
    }
    if (
      typeof doc !== 'object' ||
      doc === null ||
      !('prod' in doc) ||
      typeof (doc as { prod?: unknown }).prod !== 'object' ||
      (doc as { prod: unknown }).prod === null
    ) {
      ghError('public-config.json missing prod object');
      assert.fail('web-app: public-config.json must contain prod object');
    }
    const o = doc as { local: unknown; prod: Record<string, unknown> };
    const syncBaseUrl = `${syncUrl.replace(/\/$/, '')}/patch-db`;
    o.prod['PATCH_DB_SYNC_SERVER_URL'] = syncBaseUrl;
    assert.strictEqual(o.prod['PATCH_DB_SYNC_SERVER_URL'], syncBaseUrl);
    writeFileSync(configPath, `${JSON.stringify(o, null, 2)}\n`, 'utf8');

    const appDir = join(REPO_ROOT, 'packages/app');

    run('bunx', ['expo', 'export', '-p', 'web'], {
      cwd: appDir,
      env: { ...process.env, EXPO_PUBLIC_STAGE: 'prod' },
    });

    run('aws', ['s3', 'sync', 'dist/', `s3://${bucket}/`, '--delete'], {
      cwd: appDir,
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

    rmSync(join(REPO_ROOT, 'packages/app/dist'), { recursive: true, force: true });
    ghNotice('Web app exported and synced to S3.');
  }
}

function toHttps(raw: string): string {
  assert(raw.length > 0);
  let host = raw.trim();
  if (host.startsWith('https://')) host = host.slice('https://'.length);
  if (host.startsWith('http://')) host = host.slice('http://'.length);
  assert(host.length > 0);
  const output = `https://${host}`;
  assert(output.length > 0);
  assert(/^https:\/\//.test(output));
  return output;
}
