import type { WorkspaceReports } from '@pkgs/harness-report-shared/explorer-types';
import { listExplorerVersions } from '@pkgs/harness-report-shared/explorer-versions';
import { listCommits } from '@pkgs/harness-report-shared/read';
import type { Context } from 'hono';
import type { ReportsExplorerDeps } from './reports-explorer-route';

const NO_STORE = { 'cache-control': 'no-store' } as const;

export function reportsListRoute(deps: ReportsExplorerDeps) {
  return async (c: Context) => {
    const workspace = await deps.workspace?.();
    if (
      deps.store === null &&
      workspace === undefined &&
      deps.localStore === undefined
    )
      return c.json({ error: 'reports_unavailable' }, 503, NO_STORE);
    try {
      const page =
        deps.store === null
          ? { commits: [], cursor: null }
          : await listCommits(deps.store, {
              limit: 30,
              cursor: c.req.query('cursor') ?? null,
            });
      const evidenceVersions = c.req.query('cursor')
        ? []
        : await explorerVersions(deps);
      return c.json(
        {
          ...page,
          ...(evidenceVersions.length ? { evidenceVersions } : {}),
          ...(workspace === undefined ? {} : { workspace: workspace.version }),
          ...(deps.store === null
            ? {
                notice:
                  'Published reports are unavailable because this environment has no reports read credential. The current checkout specs and collected local evidence are available.',
              }
            : {}),
        },
        200,
        NO_STORE
      );
    } catch (error) {
      if (workspace === undefined) throw error;
      return localFallback(c, deps, workspace);
    }
  };
}

async function localFallback(
  c: Context,
  deps: ReportsExplorerDeps,
  workspace: WorkspaceReports
) {
  return c.json(
    {
      commits: [],
      cursor: null,
      workspace: workspace.version,
      evidenceVersions: deps.localStore
        ? await listExplorerVersions(deps.localStore)
        : [],
      notice:
        'The published reports store could not be reached. The current checkout specs and collected local evidence are available; try refreshing published reports.',
    },
    200,
    NO_STORE
  );
}

async function explorerVersions(
  deps: ReportsExplorerDeps
): Promise<readonly string[]> {
  const stores = [deps.store, deps.localStore].filter((store) => store != null);
  return [
    ...new Set(
      (
        await Promise.all(stores.map((store) => listExplorerVersions(store)))
      ).flat()
    ),
  ];
}
