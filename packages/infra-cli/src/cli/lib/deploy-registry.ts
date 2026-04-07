import { assert } from '@gamezilla/shared/assert';
import {
  existsSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { run, runSafe } from '../subprocess';
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

const DEFAULT_PUBLIC_CONFIG = { local: {}, prod: {} };

export class WorkersDeployable implements Deployable {
  readonly id = 'workers-api';

  constructor(private readonly platform: CiPlatform) {}

  deploy(outputs: TfOutputs): void {
    const apiDir = join(REPO_ROOT, 'packages/api');
    const env = wranglerEnv();

    const secretNames = ['DATABASE_URL'] as const;
    const secrets: Record<string, string> = {
      DATABASE_URL: requireOutput(this.platform, outputs, 'database_url'),
    };

    // Deploy the worker first so wrangler.toml is the source of truth for
    // non-secret bindings — this clears any stale plain-text vars that would
    // collide with `wrangler secret bulk` (Cloudflare API error 10053).
    run(this.platform, 'wrangler', ['deploy'], {
      cwd: apiDir,
      env,
      label: 'workers-api: Cloudflare Workers deploy',
    });

    // Best-effort delete of each secret name to avoid "binding name already in
    // use" when the binding type changed (e.g. plain_text → secret_text).
    for (const name of secretNames) {
      const del = runSafe('wrangler', ['secret', 'delete', name, '--force'], {
        cwd: apiDir,
        env,
      });
      if (del.exitCode === 0) {
        this.platform.notice(`Cleared existing binding: ${name}`);
      }
    }

    const tmp = join(tmpdir(), `wrangler-secrets-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify(secrets), 'utf8');
    try {
      run(this.platform, 'wrangler', ['secret', 'bulk', tmp], {
        cwd: apiDir,
        env,
        label: 'workers-api: sync secrets',
      });
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* best-effort cleanup */
      }
    }

    this.platform.notice('Workers API deployed.');
  }
}

export class WebAppDeployable implements Deployable {
  readonly id = 'web-app';

  constructor(private readonly platform: CiPlatform) {}

  deploy(outputs: TfOutputs): void {
    const syncUrl = toHttps(requireOutput(this.platform, outputs, 'api_url'));
    const pagesProject = requireOutput(
      this.platform,
      outputs,
      'pages_project_name'
    );

    if (!/^https:\/\//.test(syncUrl)) {
      this.platform.error(`API_URL must be https:// (got: ${syncUrl})`);
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
        this.platform.warning(
          `public-config.json is invalid JSON (${String(e)}) — recreating.`
        );
        doc = structuredClone(DEFAULT_PUBLIC_CONFIG);
      }
    }

    if (
      typeof doc !== 'object' ||
      doc === null ||
      !('prod' in doc) ||
      typeof (doc as { prod?: unknown }).prod !== 'object' ||
      (doc as { prod: unknown }).prod === null
    ) {
      this.platform.warning(
        'public-config.json missing "prod" object — adding it.'
      );
      (doc as Record<string, unknown>)['prod'] = {};
    }

    const o = doc as { local: unknown; prod: Record<string, unknown> };
    const syncBaseUrl = `${syncUrl.replace(/\/$/, '')}/patch-db`;
    o.prod['PATCH_DB_REQ_RES_URL'] = syncBaseUrl;
    writeFileSync(configPath, `${JSON.stringify(o, null, 2)}\n`, 'utf8');

    const clientDir = join(REPO_ROOT, 'packages/client');

    run(
      this.platform,
      'bunx',
      ['turbo', 'run', 'build', '--filter=@gamezilla/client'],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, EXPO_PUBLIC_STAGE: 'prod' },
        label: 'web-app: expo export (turbo)',
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
      { cwd: clientDir, env: wranglerEnv(), label: 'web-app: Cloudflare Pages deploy' }
    );

    rmSync(join(REPO_ROOT, 'packages/client/dist'), {
      recursive: true,
      force: true,
    });
    this.platform.notice('Web app exported and deployed to Cloudflare Pages.');
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
    new WebAppDeployable(platform),
  ];
  assert.ok(registry.length > 0, 'DEPLOY_REGISTRY must not be empty');
  return registry;
}
