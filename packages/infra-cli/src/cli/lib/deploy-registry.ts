import { assert } from '@gamezilla/shared/assert';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { run, runCapture } from '../subprocess';
import { requireOutput, type TfOutputs } from './tf-outputs';

/**
 * Wrangler reads CLOUDFLARE_ACCOUNT_ID to skip /memberships account discovery
 * (which fails for scoped API tokens). Secrets load the value as
 * TF_VAR_cloudflare_account_id for Terraform, so we bridge the two here.
 */
function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: process.env['TF_VAR_cloudflare_account_id'],
  };
}

export interface Deployable {
  readonly id: string;
  deploy(outputs: TfOutputs): void;
}

export class WorkersDeployable implements Deployable {
  readonly id = 'workers-api';

  constructor(private readonly platform: CiPlatform) {}

  deploy(_outputs: TfOutputs): void {
    const apiDir = join(REPO_ROOT, 'packages/api');
    const env = wranglerEnv();

    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    assert.ok(
      databaseUrl.length > 0,
      'DATABASE_URL must be set (resolved from PlanetScale Roles API)',
    );

    runCapture('wrangler', ['secret', 'put', 'DATABASE_URL'], {
      cwd: apiDir,
      env,
      input: databaseUrl,
    });
    this.platform.notice('DATABASE_URL secret pushed to Workers.');

    run(this.platform, 'wrangler', ['deploy'], {
      cwd: apiDir,
      env,
      label: 'workers-api: Cloudflare Workers deploy',
    });

    this.platform.notice('Workers API deployed.');
  }
}

export class ClientDeployable implements Deployable {
  readonly id = 'client';

  constructor(private readonly platform: CiPlatform) {}

  deploy(outputs: TfOutputs): void {
    const apiUrl = toHttps(requireOutput(this.platform, outputs, 'api_url'));
    const pagesProject = requireOutput(
      this.platform,
      outputs,
      'pages_project_name'
    );

    if (!/^https:\/\//.test(apiUrl)) {
      this.platform.error(`API_URL must be https:// (got: ${apiUrl})`);
      assert.fail('client: API URL must be https://');
    }

    const clientDir = join(REPO_ROOT, 'packages/client');

    run(
      this.platform,
      'bunx',
      ['turbo', 'run', 'build', '--filter=@gamezilla/client'],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          EXPO_PUBLIC_API_URL: apiUrl.replace(/\/$/, ''),
        },
        label: 'client: expo export (turbo)',
      }
    );

    run(
      this.platform,
      'wrangler',
      [
        'pages',
        'deploy',
        'dist/',
        '--project-name',
        pagesProject,
        '--branch',
        'main',
      ],
      { cwd: clientDir, env: wranglerEnv(), label: 'client: Cloudflare Pages deploy' }
    );

    rmSync(join(REPO_ROOT, 'packages/client/dist'), {
      recursive: true,
      force: true,
    });
    this.platform.notice('Client exported and deployed to Cloudflare Pages.');
  }
}

function toHttps(raw: string): string {
  let host = raw.trim();
  if (host.startsWith('https://')) host = host.slice('https://'.length);
  if (host.startsWith('http://')) host = host.slice('http://'.length);
  return `https://${host}`;
}

export function createDeployRegistry(
  platform: CiPlatform
): readonly Deployable[] {
  const registry: readonly Deployable[] = [
    new WorkersDeployable(platform),
    new ClientDeployable(platform),
  ];
  assert.ok(registry.length > 0, 'DEPLOY_REGISTRY must not be empty');
  return registry;
}
