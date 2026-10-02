import type { ConsoleNavState } from '@apps/product/console-nav/console-nav';
import { DEFAULT_CONSOLE_NAV } from '@apps/product/console-nav/console-nav';
import type { CheckpointSessionCtx } from '@apps/product/product-harness/product-harness-checkpoint';
import type { ProductHarness } from '@libs/harness/system/harness';
import type {
  ReleaseEvidence,
  ReleaseVerdict,
} from '@pkgs/conformance/release-check';
import type { HtmlReportTest } from '@pkgs/harness';
import type { ProductHarnessSnapshotInfo } from '@pkgs/harness-console/client';
import type { SqlNotebookDoc } from '@pkgs/harness-console/client/sql-notebook/notebook-doc';
import { createNotebookStore } from '@pkgs/harness-console/client/sql-notebook/notebook-store';
import type { SqlCellRun } from '@pkgs/harness-console/client/sql-notebook/run-sql-cell';
import type {
  CatalogQuery,
  RemoteReport,
  Route,
} from '@pkgs/harness-report/viewer';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

export type ToolsState = {
  notebookStore: ReturnType<typeof createNotebookStore>;
  notebook: SqlNotebookDoc | null;
  notebookRun: SqlCellRun | null;
  report: HtmlReportTest | null;
  route: Route;
  hit: string | null;
  catalogQuery: CatalogQuery;
  reportStore: ObjectStoreImplInMemory;
  remote: RemoteReport | null;
  snapshots: readonly ProductHarnessSnapshotInfo[];
  snapshotStore: ObjectStoreImplInMemory;
  snapshotContext: CheckpointSessionCtx | null;
  snapshotChrome: ReturnType<
    typeof import('@pkgs/harness-console/client/product-harness/use-snapshot-chrome-state')['useSnapshotChromeState']
  > | null;
  disposeChrome: (() => void) | null;
  beforeApps: Map<string, string>;
  consoleNav: ConsoleNavState;
  consoleColumns: boolean;
  releaseEvidence: readonly ReleaseEvidence[];
  releaseVerdict: ReleaseVerdict | null;
};
export function tools(s: ProductHarness): ToolsState {
  if (s.probes.tools === undefined) {
    s.probes.tools = {
      notebookStore: createNotebookStore(new ObjectStoreImplInMemory()),
      notebook: null,
      notebookRun: null,
      report: null,
      route: { view: 'list', params: {} },
      hit: null,
      catalogQuery: {
        q: '',
        status: 'all',
        group: 'none',
        sort: 'recent',
        layout: 'list',
      },
      reportStore: new ObjectStoreImplInMemory(),
      remote: null,
      snapshots: [],
      snapshotStore: new ObjectStoreImplInMemory(),
      snapshotContext: null,
      snapshotChrome: null,
      disposeChrome: null,
      beforeApps: new Map(),
      consoleNav: DEFAULT_CONSOLE_NAV,
      consoleColumns: false,
      releaseEvidence: [],
      releaseVerdict: null,
    } satisfies ToolsState;
  }
  return s.probes.tools as ToolsState;
}
