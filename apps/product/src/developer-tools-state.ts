import type { ConsoleNavState } from './console-nav';
import { DEFAULT_CONSOLE_NAV } from './console-nav';
import type { CheckpointSessionCtx } from '@libs/harness/checkpoint-state';
import type { ProductHarness } from '@libs/harness/harness';
import type {
  ReleaseEvidence,
  ReleaseVerdict,
} from '@pkgs/conformance-shared/release-check';
import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
import type { ProductHarnessSnapshotInfo } from '@pkgs/harness-console-shared/ports';
import type { SqlNotebookDoc } from '@pkgs/harness-console-client/notebook-doc';
import { createNotebookStore } from '@pkgs/harness-console-client/notebook-store';
import type { SqlCellRun } from '@pkgs/harness-console-client/run-sql-cell';
import type { CatalogQuery } from '@pkgs/harness-report-shared/catalog';
import type { RemoteReport } from '@pkgs/harness-report-client/remote-report';
import type { Route } from '@pkgs/harness-report-shared/hash';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';

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
    typeof import('@pkgs/harness-console-client/use-snapshot-chrome-state')['useSnapshotChromeState']
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
