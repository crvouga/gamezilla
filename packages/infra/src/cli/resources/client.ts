import { assert } from '@gamezilla/shared/assert';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { ok } from '../lib/fmt';
import { infraOutputs } from '../lib/infra-outputs';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runAsync } from '../subprocess';
import { ResourceBase, type InfraContext } from './types';

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: process.env['TF_VAR_cloudflare_account_id'],
  };
}

export class ClientResource extends ResourceBase {
  readonly id = 'client';

  async provision(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {}

  async deploy(platform: CiPlatform, ctx: InfraContext): Promise<void> {
    const outputs = infraOutputs(ctx);
    const apiUrl = toHttps(outputs.api_url);
    const pagesProject = outputs.pages_project_name;

    if (!/^https:\/\//.test(apiUrl)) {
      platform.error(`API_URL must be https:// (got: ${apiUrl})`);
      assert.fail('client: API URL must be https://');
    }

    const clientDir = join(REPO_ROOT, 'packages/client');

    await runAsync(
      platform,
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

    await runAsync(
      platform,
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
      {
        cwd: clientDir,
        env: wranglerEnv(),
        label: 'client: Cloudflare Pages deploy',
      }
    );

    rmSync(join(REPO_ROOT, 'packages/client/dist'), {
      recursive: true,
      force: true,
    });

    platform.notice('Client exported and deployed to Cloudflare Pages.');
  }

  async destroy(): Promise<void> {
    ok('Client', 'managed by pages-project — skipping');
  }
}

function toHttps(raw: string): string {
  let host = raw.trim();
  if (host.startsWith('https://')) host = host.slice('https://'.length);
  if (host.startsWith('http://')) host = host.slice('http://'.length);
  return `https://${host}`;
}
