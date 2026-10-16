import type { CheckpointSessionCtx } from '@libs/harness/checkpoint-state';
import type { ProductHarness } from '@libs/harness/harness';
import type {
  ReleaseEvidence,
  ReleaseVerdict,
} from '@pkgs/conformance-shared/release-check';
import type { SqlNotebookDoc } from '@pkgs/harness-console-client/notebook-doc';
import { createNotebookStore } from '@pkgs/harness-console-client/notebook-store';
import type { SqlCellRun } from '@pkgs/harness-console-client/run-sql-cell';
import type { ProductHarnessSnapshotInfo } from '@pkgs/harness-console-shared/ports';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import type { ConsoleNavState } from './console-nav';
import { DEFAULT_CONSOLE_NAV } from './console-nav';

export type ToolsState = {
  notebookStore: ReturnType<typeof createNotebookStore>;
  notebook: SqlNotebookDoc | null;
  notebookRun: SqlCellRun | null;
  snapshots: readonly ProductHarnessSnapshotInfo[];
  snapshotStore: ObjectStoreImplInMemory;
  snapshotContext: CheckpointSessionCtx | null;
  snapshotChrome: ReturnType<
    typeof import('@pkgs/harness-console-client/use-snapshot-chrome-state')['useSnapshotChromeState']
  > | null;
  disposeChrome: (() => void) | null;
  beforeApps: Map<string, string>;
  checkpointApps: Map<string, Map<string, string>>;
  checkpointIds: Map<string, string>;
  keptApps: Map<string, string>;
  beforeRestoreApps: Map<string, string>;
  firstWorldPath: string | null;
  restoreFailure: 'none' | 'failed';
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
      snapshots: [],
      snapshotStore: new ObjectStoreImplInMemory(),
      snapshotContext: null,
      snapshotChrome: null,
      disposeChrome: null,
      beforeApps: new Map(),
      checkpointApps: new Map(),
      checkpointIds: new Map(),
      keptApps: new Map(),
      beforeRestoreApps: new Map(),
      firstWorldPath: null,
      restoreFailure: 'none',
      consoleNav: DEFAULT_CONSOLE_NAV,
      consoleColumns: false,
      releaseEvidence: [],
      releaseVerdict: null,
    } satisfies ToolsState;
  }
  return s.probes.tools as ToolsState;
}
