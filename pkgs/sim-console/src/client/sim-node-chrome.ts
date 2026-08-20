import {
  DatabaseIcon,
  DoorOpenIcon,
  type IconComponent,
  MonitorIcon,
  RadioIcon,
  ServerIcon,
} from '@pkgs/ui';

import type { SystemNodeKind } from '../shared/system-node';

const NODE_ICONS: Readonly<Record<SystemNodeKind, IconComponent>> = {
  client: MonitorIcon,
  api: ServerIcon,
  events: RadioIcon,
  room: DoorOpenIcon,
  db: DatabaseIcon,
};

export function systemNodeIcon(kind: SystemNodeKind): IconComponent {
  return NODE_ICONS[kind];
}
