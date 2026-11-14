import type { DebuggerViewId } from '@pkgs/harness-console-shared-ts/debugger-views';
import type { HarnessSwitcherChoice } from '@pkgs/harness-console-shared-ts/harness-windows';
import type { TabStripItem } from '@pkgs/ui-devtools-client-ts/tab-strip-types';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  CodeIcon,
  DatabaseIcon,
  PaintbrushIcon,
  RadioIcon,
  ShuffleIcon,
  TerminalIcon,
} from '@pkgs/ui-root-client-ts/icons';

export type PaneNavValue = {
  readonly view: DebuggerViewId;
};

export type PaneNavPatch = {
  readonly view?: string;
};

export type PaneNavHistoryMode = 'push' | 'replace';

/**
 * Where the console is, held by the host so it can live in the address: the
 * panel on show (`null` for the first client's), the view each node's
 * panel shows, keyed by panel id, and which views the switcher goes through.
 */
export type HarnessConsoleNav = {
  readonly show: string | null;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly switcher: HarnessSwitcherChoice;
  readonly onShow: (panel: string | null, mode: PaneNavHistoryMode) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: PaneNavHistoryMode
  ) => void;
  /** Put a view in the switcher, or take it out. */
  readonly onSwitcher: (view: string, on: boolean) => void;
};

const VIEW_CHROME: Readonly<
  Record<
    DebuggerViewId,
    { readonly label: string; readonly icon: IconComponent }
  >
> = {
  ui: { label: 'UI', icon: PaintbrushIcon },
  db: { label: 'SQL', icon: DatabaseIcon },
  events: { label: 'Events', icon: RadioIcon },
  commands: { label: 'Commands', icon: TerminalIcon },
  topics: { label: 'Topics', icon: CodeIcon },
  routes: { label: 'Routes', icon: ShuffleIcon },
};

export function debuggerViewTabItem(view: DebuggerViewId): TabStripItem {
  const chrome = VIEW_CHROME[view];
  return { id: view, label: chrome.label, icon: chrome.icon };
}
