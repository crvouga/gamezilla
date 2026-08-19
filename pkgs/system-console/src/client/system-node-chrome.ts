import {
  DatabaseIcon,
  DoorOpenIcon,
  type IconComponent,
  MonitorIcon,
  PaintbrushIcon,
  RadioIcon,
  ServerIcon,
  type TabStripItem,
} from '@pkgs/ui';

import {
  coerceSystemNodeKind,
  formatSystemNodeLabel,
  SYSTEM_CHROME_KINDS,
  SYSTEM_NODE_LABELS,
  type SystemChromeKind,
  type SystemNodeKind,
} from '../shared/system-node';

type ReportViewKind = 'html' | 'sqlite' | 'events';

const NODE_ICONS: Readonly<Record<SystemNodeKind, IconComponent>> = {
  client: MonitorIcon,
  api: ServerIcon,
  events: RadioIcon,
  room: DoorOpenIcon,
  db: DatabaseIcon,
};

const REPORT_VIEW_CHROME: Readonly<
  Record<
    ReportViewKind,
    { readonly label: string; readonly icon: IconComponent }
  >
> = {
  html: { label: 'UI', icon: PaintbrushIcon },
  sqlite: { label: 'DB', icon: DatabaseIcon },
  events: { label: 'Events', icon: RadioIcon },
};

export function systemNodeIcon(kind: SystemNodeKind): IconComponent {
  return NODE_ICONS[kind];
}

export const PLAYGROUND_KIND_TABS: readonly TabStripItem[] =
  SYSTEM_CHROME_KINDS.map((id: SystemChromeKind) => ({
    id,
    label: SYSTEM_NODE_LABELS[id],
    icon: NODE_ICONS[id],
  }));

export function systemNodeTabItem(args: {
  readonly id: string;
  readonly kind: string;
}): TabStripItem {
  const kind =
    coerceSystemNodeKind(args.kind) ??
    coerceSystemNodeKind(args.id.split(':')[0] ?? '');
  return {
    id: args.id,
    label: formatSystemNodeLabel({ id: args.id, kind: kind ?? args.kind }),
    ...(kind !== null ? { icon: NODE_ICONS[kind] } : {}),
  };
}

export function reportViewTabItem(view: ReportViewKind): TabStripItem {
  const chrome = REPORT_VIEW_CHROME[view];
  return { id: view, label: chrome.label, icon: chrome.icon };
}
