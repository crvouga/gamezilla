import {
  CodeIcon,
  DatabaseIcon,
  type IconComponent,
  PaintbrushIcon,
  RadioIcon,
  type TabStripItem,
  TerminalIcon,
} from '@pkgs/ui';

import type { DebuggerViewId } from '../shared/debugger-views';
import {
  coerceSystemNodeKind,
  formatSystemNodeLabel,
  SYSTEM_CHROME_KINDS,
  SYSTEM_NODE_LABELS,
  type SystemChromeKind,
  type SystemNodeKind,
} from '../shared/system-node';
import { systemNodeIcon } from './system-node-chrome';

export type DebuggerChromeNav = {
  readonly kind: SystemChromeKind;
  readonly instance: string;
  readonly view: string;
  readonly onKindChange: (kind: SystemChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onViewChange: (view: string) => void;
};

const VIEW_CHROME: Readonly<
  Record<
    DebuggerViewId,
    { readonly label: string; readonly icon: IconComponent }
  >
> = {
  ui: { label: 'UI', icon: PaintbrushIcon },
  db: { label: 'DB', icon: DatabaseIcon },
  events: { label: 'Events', icon: RadioIcon },
  commands: { label: 'Commands', icon: TerminalIcon },
  topics: { label: 'Topics', icon: CodeIcon },
};

export const DEBUGGER_KIND_TABS: readonly TabStripItem[] =
  SYSTEM_CHROME_KINDS.map((id: SystemChromeKind) => ({
    id,
    label: SYSTEM_NODE_LABELS[id],
    icon: systemNodeIcon(id),
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
    coerceSystemNodeKind(args.kind) ??
    coerceSystemNodeKind(args.id.split(':')[0] ?? '');
  return {
    id: args.id,
    label: formatSystemNodeLabel({ id: args.id, kind: kind ?? args.kind }),
    ...(kind !== null ? { icon: systemNodeIcon(kind as SystemNodeKind) } : {}),
  };
}
