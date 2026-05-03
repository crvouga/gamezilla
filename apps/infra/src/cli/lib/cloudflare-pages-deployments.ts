import { assert } from '@gamezilla/lib/assert';
import { info, ok, warn } from './fmt';

const CF_API = 'https://api.cloudflare.com/client/v4';
const LIST_PAGE_SIZE = 25;
const DEFAULT_DELETE_CONCURRENCY = 5;
const DEFAULT_DELETE_ATTEMPTS = 3;

interface Deployment {
  id: string;
  environment: 'production' | 'preview';
  aliases: string[] | null;
  created_on: string;
}

interface PagesProject {
  production_deployment?: { id: string } | null;
}

interface CfListResponse<T> {
  success: boolean;
  result: T[];
  result_info: {
    page: number;
    total_pages: number;
  };
  errors?: Array<{ message: string }>;
}

interface CfSingleResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ message: string }>;
}

class CfHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`CF API ${status}: ${body}`);
  }
}

export interface CleanupPagesDeploymentsOptions {
  accountId: string;
  projectName: string;
  headers: Record<string, string>;
  deleteAliased?: boolean;
  concurrency?: number;
  attempts?: number;
}

export interface CleanupPagesDeploymentsResult {
  total: number;
  deleted: number;
  failed: number;
  skippedAliased: number;
  keptProductionId: string | null;
}

async function cfGet<T>(
  path: string,
  headers: Record<string, string>
): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new CfHttpError(res.status, body);
  }
  return (await res.json()) as T;
}

async function getProject(
  accountId: string,
  projectName: string,
  headers: Record<string, string>
): Promise<PagesProject> {
  const resp = await cfGet<CfSingleResponse<PagesProject>>(
    `/accounts/${accountId}/pages/projects/${projectName}`,
    headers
  );
  if (!resp.success) {
    throw new Error(
      `Failed to fetch Pages project ${projectName}: ${resp.errors?.map((e) => e.message).join(', ')}`
    );
  }
  return resp.result;
}

async function listAllDeployments(
  accountId: string,
  projectName: string,
  headers: Record<string, string>
): Promise<Deployment[]> {
  const all: Deployment[] = [];
  let page = 1;

  while (true) {
    const resp = await cfGet<CfListResponse<Deployment>>(
      `/accounts/${accountId}/pages/projects/${projectName}/deployments?page=${page}&per_page=${LIST_PAGE_SIZE}`,
      headers
    );
    if (!resp.success) {
      throw new Error(
        `Failed to list deployments for ${projectName}: ${resp.errors?.map((e) => e.message).join(', ')}`
      );
    }
    all.push(...resp.result);
    if (page >= resp.result_info.total_pages) break;
    page++;
  }

  return all;
}

function hasAlias(d: Deployment): boolean {
  return Array.isArray(d.aliases) && d.aliases.length > 0;
}

async function deleteDeployment(
  accountId: string,
  projectName: string,
  headers: Record<string, string>,
  id: string
): Promise<boolean> {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/pages/projects/${projectName}/deployments/${id}?force=true`,
    { method: 'DELETE', headers }
  );
  return res.ok;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pooled<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++;
      assert.ok(i < items.length, 'pooled worker index out of bounds');
      await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

export async function cleanupPagesDeployments(
  options: CleanupPagesDeploymentsOptions
): Promise<CleanupPagesDeploymentsResult> {
  const accountId = options.accountId.trim();
  const projectName = options.projectName.trim();
  const headers = options.headers;
  const deleteAliased = options.deleteAliased ?? true;
  const concurrency = Math.max(
    1,
    options.concurrency ?? DEFAULT_DELETE_CONCURRENCY
  );
  const attempts = Math.max(1, options.attempts ?? DEFAULT_DELETE_ATTEMPTS);

  assert.ok(
    accountId.length > 0,
    'cleanupPagesDeployments: accountId required'
  );
  assert.ok(
    projectName.length > 0,
    'cleanupPagesDeployments: projectName required'
  );
  assert.ok(headers && typeof headers === 'object', 'headers are required');

  info('Pages deployments', `project=${projectName}`);
  let project: PagesProject;
  try {
    project = await getProject(accountId, projectName, headers);
  } catch (e) {
    if (e instanceof CfHttpError && e.status === 404) {
      ok('Pages deployments', `project ${projectName} does not exist`);
      return {
        total: 0,
        deleted: 0,
        failed: 0,
        skippedAliased: 0,
        keptProductionId: null,
      };
    }
    throw e;
  }
  const liveProductionId = project.production_deployment?.id ?? null;
  if (liveProductionId) {
    info('Keeping live production deployment', liveProductionId);
  } else {
    warn('Pages deployments', 'no live production deployment found');
  }

  const deployments = await listAllDeployments(accountId, projectName, headers);
  const toDelete = deployments.filter((deployment) => {
    if (deployment.id === liveProductionId) return false;
    if (!deleteAliased && hasAlias(deployment)) return false;
    return true;
  });

  const skippedAliased = deleteAliased
    ? 0
    : deployments.filter((d) => d.id !== liveProductionId && hasAlias(d))
        .length;
  if (skippedAliased > 0) {
    info('Skipped aliased deployments', String(skippedAliased));
  }

  if (toDelete.length === 0) {
    ok('Pages deployments', 'nothing to delete');
    return {
      total: deployments.length,
      deleted: 0,
      failed: 0,
      skippedAliased,
      keptProductionId: liveProductionId,
    };
  }

  let deleted = 0;
  let failed = 0;

  await pooled(toDelete, concurrency, async (deployment) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const success = await deleteDeployment(
        accountId,
        projectName,
        headers,
        deployment.id
      );
      if (success) {
        deleted++;
        return;
      }
      await sleep((attempt + 1) * 1_000);
    }
    failed++;
    warn('Delete deployment failed', deployment.id);
  });

  ok(
    'Pages deployments cleanup',
    `deleted=${deleted}, failed=${failed}, total=${deployments.length}`
  );

  return {
    total: deployments.length,
    deleted,
    failed,
    skippedAliased,
    keptProductionId: liveProductionId,
  };
}
