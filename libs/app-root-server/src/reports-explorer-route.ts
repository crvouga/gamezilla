import type { WorkspaceReports } from '@pkgs/harness-report-shared/explorer-types';
import { isCommitSha } from '@pkgs/harness-report-shared/keys';
import {
  latestParts,
  readParts,
} from '@pkgs/harness-report-shared/report-parts';
import {
  isSpecPath,
  readInventory,
  readSpecDocument,
} from '@pkgs/harness-report-shared/spec-inventory';
import { Hono } from 'hono';
import type { ReportsStores } from './reports-store';

export type ReportsExplorerDeps = ReportsStores & {
  readonly workspace?: () => Promise<WorkspaceReports>;
};

const NO_STORE = { 'cache-control': 'no-store' } as const;

export function createReportsExplorerApp(deps: ReportsExplorerDeps) {
  return new Hono()
    .get('/:sha/explorer', async (c) => {
      const sha = c.req.param('sha');
      if (!isCommitSha(sha))
        return c.json({ error: 'not_found' }, 404, NO_STORE);
      const workspace = await deps.workspace?.();
      const local = workspace?.version.sha === sha ? workspace : null;
      const { inventory, parts, notice } = await explorerData(deps, sha, local);
      if (deps.store === null && inventory === null && parts.length === 0)
        return c.json({ error: 'reports_unavailable' }, 503, NO_STORE);
      return c.json(
        { inventory, parts: latestParts(parts), ...(notice ? { notice } : {}) },
        200,
        NO_STORE
      );
    })
    .get('/:sha/spec', async (c) => {
      const sha = c.req.param('sha');
      const path = c.req.query('path') ?? '';
      if (!isCommitSha(sha) || !isSpecPath(path))
        return c.json({ error: 'not_found' }, 404, NO_STORE);
      const workspace = await deps.workspace?.();
      const localBody = deps.localStore
        ? await readSpecDocument(deps.localStore, sha, path)
        : null;
      const body =
        workspace?.version.sha === sha
          ? await workspace.readSpec(path)
          : localBody !== null
            ? localBody
            : deps.store === null
              ? null
              : await readSpecDocument(deps.store, sha, path);
      return body === null
        ? c.json({ error: 'not_found' }, 404, NO_STORE)
        : new Response(body, {
            headers: {
              ...NO_STORE,
              'content-type': 'text/plain; charset=utf-8',
            },
          });
    });
}

async function explorerData(
  deps: ReportsExplorerDeps,
  sha: string,
  local: WorkspaceReports | null
) {
  let inventory =
    local?.inventory ??
    (deps.localStore ? await readInventory(deps.localStore, sha) : null);
  const localParts =
    local?.parts ??
    (deps.localStore ? await readParts(deps.localStore, sha) : []);
  let parts = [...localParts];
  let notice: string | undefined;
  try {
    if (deps.store !== null) {
      inventory ??= await readInventory(deps.store, sha);
      parts = [...(await readParts(deps.store, sha)), ...localParts];
    }
  } catch (error) {
    if (inventory === null && parts.length === 0) throw error;
    notice =
      'Published evidence could not be read. Available specs and evidence remain readable. Refresh to try again.';
  }
  return { inventory, parts, notice };
}
