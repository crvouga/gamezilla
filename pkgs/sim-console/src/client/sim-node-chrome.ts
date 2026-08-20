import {
  DatabaseIcon,
  DoorOpenIcon,
  type IconComponent,
  MonitorIcon,
  RadioIcon,
  ServerIcon,
} from '@pkgs/ui';

import type { SimNodeKind } from '../shared/sim-node';

const NODE_ICONS: Readonly<Record<SimNodeKind, IconComponent>> = {
  client: MonitorIcon,
  api: ServerIcon,
  events: RadioIcon,
  room: DoorOpenIcon,
  db: DatabaseIcon,
};

export function systemNodeIcon(kind: SimNodeKind): IconComponent {
  return NODE_ICONS[kind];
}
