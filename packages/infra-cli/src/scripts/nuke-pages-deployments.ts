#!/usr/bin/env bun
/**
 * Bulk-delete Cloudflare Pages deployments so the project can be deleted.
 *
 * Cloudflare won't let you delete a Pages project with >100 deployments.
 * This script pages through all deployments, keeps the live production one,
 * and deletes everything else.
 *
 * Usage:
 *   bun run nuke-pages-deployments
 *
 * Environment variables (all optional — falls back to sensible defaults):
 *   CLOUDFLARE_API_TOKEN              — CF API token with Pages Edit permission
 *   TF_VAR_cloudflare_account_id      — CF account ID
 *   CF_PAGES_PROJECT_NAME             — Pages project name
 *   CF_DELETE_ALIASED_DEPLOYMENTS     — "true" to also delete aliased deployments
 *   CF_DRY_RUN                        — "true" to list without deleting
 *   CF_CONCURRENCY                    — parallel delete requests (default 5)
 */

import { banner, fail, fmt, info, kv, ok, warn } from '../cli/lib/fmt';
import { cfHeaders } from '../cli/secrets/cloudflare';
import { runSafe } from '../cli/subprocess';

const CF_API = 'https://api.cloudflare.com/client/v4';

const ACCOUNT_ID =
  process.env['TF_VAR_cloudflare_account_id'] ??
  '2698e76355a8c8d1ee21e15fa9fd44f7';

const PROJECT_NAME =
  process.env['CF_PAGES_PROJECT_NAME'] ?? 'gamezilla-app-frontend';

const DELETE_ALIASED = process.env['CF_DELETE_ALIASED_DEPLOYMENTS'] === 'true';

const DRY_RUN = process.env['CF_DRY_RUN'] === 'true';

const CONCURRENCY = Math.max(1, Number(process.env['CF_CONCURRENCY'] ?? '5'));

function resolveToken(): string {
  const fromEnv = process.env['CLOUDFLARE_API_TOKEN'];
  if (fromEnv) return fromEnv;

  info('CLOUDFLARE_API_TOKEN not in env, trying Doppler…');
  const r = runSafe('doppler', [
    'secrets',
    'get',
    'CLOUDFLARE_API_TOKEN',
    '--plain',
  ]);
  const value = r.stdout.trim();
  if (r.exitCode === 0 && value) {
    ok('Loaded token from Doppler');
    return value;
  }

  return '';
}

const TOKEN = resolveToken();

// ---------------------------------------------------------------------------

interface Deployment {
  id: string;
  environment: 'production' | 'preview';
  aliases: string[] | null;
  created_on: string;
  url: string;
  latest_stage: { name: string; status: string } | null;
}

interface PagesProject {
  production_deployment?: { id: string } | null;
}

interface CfListResponse<T> {
  success: boolean;
  result: T[];
  result_info: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
  errors?: Array<{ message: string }>;
}

interface CfSingleResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------

function requireToken(): string {
  if (!TOKEN) {
    fail('CLOUDFLARE_API_TOKEN is not set');
    console.log('');
    console.log('Create a token at:');
    console.log(fmt.cyan('  https://dash.cloudflare.com/profile/api-tokens'));
    console.log('Required permission: Cloudflare Pages — Edit');
    process.exit(1);
  }
  return TOKEN;
}

async function cfGet<T>(
  path: string,
  headers: Record<string, string>
): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CF API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function getProject(
  headers: Record<string, string>
): Promise<PagesProject> {
  const resp = await cfGet<CfSingleResponse<PagesProject>>(
    `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`,
    headers
  );
  if (!resp.success) {
    throw new Error(
      `Failed to fetch project: ${resp.errors?.map((e) => e.message).join(', ')}`
    );
  }
  return resp.result;
}

async function listAllDeployments(
  headers: Record<string, string>
): Promise<Deployment[]> {
  const all: Deployment[] = [];
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await cfGet<CfListResponse<Deployment>>(
      `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments?page=${page}&per_page=25`,
      headers
    );
    if (!resp.success) {
      throw new Error(
        `Failed to list deployments: ${resp.errors?.map((e) => e.message).join(', ')}`
      );
    }
    all.push(...resp.result);

    if (page >= resp.result_info.total_pages) break;
    page++;
  }

  return all;
}

async function deleteDeployment(
  headers: Record<string, string>,
  id: string
): Promise<boolean> {
  const res = await fetch(
    `${CF_API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${id}?force=true`,
    { method: 'DELETE', headers }
  );
  return res.ok;
}

function hasAlias(d: Deployment): boolean {
  return Array.isArray(d.aliases) && d.aliases.length > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run async tasks with bounded concurrency. */
async function pooled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  banner('Nuke Pages Deployments');

  kv('Account', ACCOUNT_ID);
  kv('Project', PROJECT_NAME);
  kv('Delete aliased', DELETE_ALIASED ? 'yes' : 'no');
  kv('Concurrency', String(CONCURRENCY));
  if (DRY_RUN) warn('DRY RUN — nothing will be deleted');
  console.log('');

  const token = requireToken();
  const headers = cfHeaders(token);

  info('Fetching project info…');
  const project = await getProject(headers);
  const liveProductionId = project.production_deployment?.id ?? null;

  if (liveProductionId) {
    ok('Live production deployment', liveProductionId);
  } else {
    warn('No live production deployment found');
  }

  info('Listing all deployments (this may take a moment)…');
  const deployments = await listAllDeployments(headers);
  ok(`Found ${deployments.length} total deployments`);

  const toDelete = deployments.filter((d) => {
    if (d.id === liveProductionId) return false;
    if (!DELETE_ALIASED && hasAlias(d)) return false;
    return true;
  });

  const skippedAliased = DELETE_ALIASED
    ? 0
    : deployments.filter((d) => d.id !== liveProductionId && hasAlias(d))
        .length;

  info(`Deployments to delete: ${fmt.bold(String(toDelete.length))}`);
  if (skippedAliased > 0) {
    info(
      `Skipping ${skippedAliased} aliased deployment(s)`,
      'set CF_DELETE_ALIASED_DEPLOYMENTS=true to include'
    );
  }

  if (toDelete.length === 0) {
    ok('Nothing to delete');
    return;
  }

  if (DRY_RUN) {
    for (const d of toDelete) {
      const alias = hasAlias(d) ? ` [${d.aliases!.join(', ')}]` : '';
      info(`  ${d.id}  ${d.environment}  ${d.created_on}${alias}`);
    }
    warn('DRY RUN — re-run without CF_DRY_RUN=true to delete');
    return;
  }

  console.log('');
  let deleted = 0;
  let failed = 0;

  await pooled(toDelete, CONCURRENCY, async (d) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const success = await deleteDeployment(headers, d.id);
      if (success) {
        deleted++;
        const pct = Math.round((deleted / toDelete.length) * 100);
        process.stdout.write(
          `\r${fmt.green('●')} Deleted ${deleted}/${toDelete.length} (${pct}%)`
        );
        return;
      }
      await sleep(1_000 * (attempt + 1));
    }
    failed++;
    console.log('');
    fail(`Failed to delete ${d.id} after 3 attempts`);
  });

  console.log('');
  console.log('');
  ok(`Deleted ${deleted} deployment(s)`);
  if (failed > 0) fail(`Failed to delete ${failed} deployment(s)`);

  const remaining = deployments.length - deleted;
  info(`Remaining deployments: ~${remaining}`);

  if (remaining <= 1) {
    ok('Project should now be deletable from the dashboard');
  } else if (failed > 0) {
    warn('Re-run to retry failed deletions');
  }
}

main().catch((e) => {
  fail(String(e));
  process.exit(1);
});
