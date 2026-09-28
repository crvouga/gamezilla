import {
  CodeIcon,
  DatabaseIcon,
  type IconComponent,
  PaintbrushIcon,
  RadioIcon,
  ShuffleIcon,
  TerminalIcon,
} from '@pkgs/ui';
import type { TabStripItem } from '@pkgs/ui-devtools';

import type { DebuggerViewId } from '../shared/debugger-views';
import {
  coerceHarnessNodeKind,
  formatHarnessNodeLabel,
  HARNESS_CHROME_KINDS,
  HARNESS_NODE_LABELS,
  type HarnessChromeKind,
  type HarnessNodeKind,
} from '../shared/node';
import { harnessNodeIcon } from './node-chrome';

export type PaneNavValue = {
  readonly view: DebuggerViewId;
};

export type PaneNavPatch = {
  readonly view?: string;
};

export type DebuggerChromeNav = {
  readonly kind: HarnessChromeKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly onKindChange: (kind: HarnessChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  /** Patch one node's pane; `replace` for high-frequency table selection. */
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
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

export const DEBUGGER_KIND_TABS: readonly TabStripItem[] =
  HARNESS_CHROME_KINDS.map((id: HarnessChromeKind) => ({
    id,
    label: HARNESS_NODE_LABELS[id],
    icon: harnessNodeIcon(id),
  }));

export function debuggerViewTabItem(view: DebuggerViewId): TabStripItem {
  const chrome = VIEW_CHROME[view];
  return { id: view, label: chrome.label, icon: chrome.icon };
}

export function debuggerInstanceTabItem(args: {
  readonly id: string;
  readonly kind: string;
}): TabStripItem {
  const kind =
    coerceHarnessNodeKind(args.kind) ??
    coerceHarnessNodeKind(args.id.split(':')[0] ?? '');
  return {
    id: args.id,
    label: formatHarnessNodeLabel({ id: args.id, kind: kind ?? args.kind }),
    ...(kind !== null
      ? { icon: harnessNodeIcon(kind as HarnessNodeKind) }
      : {}),
  };
}
