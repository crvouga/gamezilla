import { assert } from '@gamezilla/shared/assert';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireOutput, type TfOutputs } from './tf-outputs';
import type { CiPlatform } from './ci-platform';
import type { Deployable } from './deployable';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

const DEFAULT_PUBLIC_CONFIG = { local: {}, prod: {} };

export class WebAppDeployable implements Deployable {
  readonly id = 'web-app';

  constructor(protected readonly platform: CiPlatform) {}

  deploy(outputs: TfOutputs): void {
    const syncUrl = toHttps(requireOutput(this.platform, outputs, 'req_res_url'));
    const bucket = requireOutput(this.platform, outputs, 'web_app_bucket_name');
    const distId = requireOutput(this.platform, outputs, 'web_distribution_id');

    if (!/^https:\/\//.test(syncUrl)) {
      this.platform.error(`PATCH_DB_REQ_RES_URL must be https:// (got: ${syncUrl})`);
      assert.fail('web-app: sync URL must be https://');
    }

    const configPath = join(REPO_ROOT, 'public-config.json');
    let doc: unknown;

    if (!existsSync(configPath)) {
      this.platform.notice('public-config.json not found — creating default.');
      doc = structuredClone(DEFAULT_PUBLIC_CONFIG);
    } else {
      try {
        doc = JSON.parse(readFileSync(configPath, 'utf8'));
      } catch (e) {
        this.platform.warning(`public-config.json is invalid JSON (${String(e)}) — recreating.`);
        doc = structuredClone(DEFAULT_PUBLIC_CONFIG);
      }
    }

    if (
      typeof doc !== 'object' || doc === null ||
      !('prod' in doc) ||
      typeof (doc as { prod?: unknown }).prod !== 'object' ||
      (doc as { prod: unknown }).prod === null
    ) {
      this.platform.warning('public-config.json missing "prod" object — adding it.');
      (doc as Record<string, unknown>)['prod'] = {};
    }

    const o = doc as { local: unknown; prod: Record<string, unknown> };
    const syncBaseUrl = `${syncUrl.replace(/\/$/, '')}/patch-db`;
    o.prod['PATCH_DB_REQ_RES_URL'] = syncBaseUrl;
    writeFileSync(configPath, `${JSON.stringify(o, null, 2)}\n`, 'utf8');

    const appDir = join(REPO_ROOT, 'packages/app');

    run(this.platform, 'bunx', ['expo', 'export', '-p', 'web'], {
      cwd: appDir,
      env: { ...process.env, EXPO_PUBLIC_STAGE: 'prod' },
      label: 'web-app: expo export',
    });

    run(this.platform, 'aws', [
      's3', 'sync', 'dist/', `s3://${bucket}/`, '--delete', '--exclude', '*.wasm',
    ], { cwd: appDir, label: 'web-app: S3 sync (non-wasm)' });

    run(this.platform, 'aws', [
      's3', 'sync', 'dist/', `s3://${bucket}/`,
      '--exclude', '*', '--include', '*.wasm', '--content-type', 'application/wasm',
    ], { cwd: appDir, label: 'web-app: S3 sync (wasm)' });

    run(this.platform, 'aws', [
      'cloudfront', 'create-invalidation', '--distribution-id', distId, '--paths', '/*',
    ], { cwd: REPO_ROOT, label: 'web-app: CloudFront invalidation' });

    rmSync(join(REPO_ROOT, 'packages/app/dist'), { recursive: true, force: true });
    this.platform.notice('Web app exported and synced to S3.');
  }
}

function toHttps(raw: string): string {
  let host = raw.trim();
  if (host.startsWith('https://')) host = host.slice('https://'.length);
  if (host.startsWith('http://')) host = host.slice('http://'.length);
  return `https://${host}`;
}
