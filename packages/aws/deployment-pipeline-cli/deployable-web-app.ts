import { assert } from '@gamezilla/shared/assert';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireOutput, type StackOutputs } from './cdk-outputs';
import type { CiPlatform } from './ci-platform';
import type { Deployable } from './deployable';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

export class WebAppDeployable implements Deployable {
  readonly id = 'web-app';

  constructor(protected readonly platform: CiPlatform) {}

  deploy(outputs: StackOutputs): void {
    const syncUrl = toHttps(
      requireOutput(this.platform, outputs, 'SyncServerUrl')
    );
    const bucket = requireOutput(this.platform, outputs, 'WebAppBucketName');
    const distId = requireOutput(this.platform, outputs, 'WebDistributionId');

    if (!/^https:\/\//.test(syncUrl)) {
      this.platform.error(
        `PATCH_DB_SYNC_SERVER_URL must be https:// (got: ${syncUrl})`
      );
      assert.fail('web-app: sync URL must be https://');
    }

    const configPath = join(REPO_ROOT, 'public-config.json');
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (e) {
      this.platform.error(`public-config.json: ${String(e)}`);
      assert.fail('web-app: public-config.json must be valid JSON');
    }
    if (
      typeof doc !== 'object' ||
      doc === null ||
      !('prod' in doc) ||
      typeof (doc as { prod?: unknown }).prod !== 'object' ||
      (doc as { prod: unknown }).prod === null
    ) {
      this.platform.error('public-config.json missing prod object');
      assert.fail('web-app: public-config.json must contain prod object');
    }
    const o = doc as { local: unknown; prod: Record<string, unknown> };
    const syncBaseUrl = `${syncUrl.replace(/\/$/, '')}/patch-db`;
    o.prod['PATCH_DB_SYNC_SERVER_URL'] = syncBaseUrl;
    assert.equals(
      o.prod['PATCH_DB_SYNC_SERVER_URL'],
      syncBaseUrl,
      'web-app: sync URL must be set'
    );
    writeFileSync(configPath, `${JSON.stringify(o, null, 2)}\n`, 'utf8');

    const appDir = join(REPO_ROOT, 'packages/app');

    run(this.platform, 'bunx', ['expo', 'export', '-p', 'web'], {
      cwd: appDir,
      env: { ...process.env, EXPO_PUBLIC_STAGE: 'prod' },
    });

    run(
      this.platform,
      'aws',
      ['s3', 'sync', 'dist/', `s3://${bucket}/`, '--delete'],
      {
        cwd: appDir,
      }
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

    rmSync(join(REPO_ROOT, 'packages/app/dist'), {
      recursive: true,
      force: true,
    });
    this.platform.notice('Web app exported and synced to S3.');
  }
}

function toHttps(raw: string): string {
  assert.ok(raw.length > 0, 'toHttps: raw must be non-empty');
  let host = raw.trim();
  if (host.startsWith('https://')) host = host.slice('https://'.length);
  if (host.startsWith('http://')) host = host.slice('http://'.length);
  assert.ok(
    host.length > 0,
    'toHttps: host must be non-empty after stripping protocol'
  );
  const output = `https://${host}`;
  assert.ok(output.length > 0, 'toHttps: output must be non-empty');
  assert.ok(
    /^https:\/\//.test(output),
    'toHttps: output must start with https://'
  );
  return output;
}
