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
  coerceSimNodeKind,
  formatSimNodeLabel,
  SIM_CHROME_KINDS,
  SIM_NODE_LABELS,
  type SimChromeKind,
  type SimNodeKind,
} from '../shared/sim-node';
import { simNodeIcon } from './sim-node-chrome';

export type DebuggerChromeNav = {
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly view: string;
  readonly onKindChange: (kind: SimChromeKind) => void;
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

export const DEBUGGER_KIND_TABS: readonly TabStripItem[] = SIM_CHROME_KINDS.map(
  (id: SimChromeKind) => ({
    id,
    label: SIM_NODE_LABELS[id],
    icon: simNodeIcon(id),
  })
);

export function debuggerViewTabItem(view: DebuggerViewId): TabStripItem {
  const chrome = VIEW_CHROME[view];
  return { id: view, label: chrome.label, icon: chrome.icon };
}

export function debuggerInstanceTabItem(args: {
  readonly id: string;
  readonly kind: string;
}): TabStripItem {
  const kind =
    coerceSimNodeKind(args.kind) ??
    coerceSimNodeKind(args.id.split(':')[0] ?? '');
  return {
    id: args.id,
    label: formatSimNodeLabel({ id: args.id, kind: kind ?? args.kind }),
    ...(kind !== null ? { icon: simNodeIcon(kind as SimNodeKind) } : {}),
  };
}
