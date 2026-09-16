import {
  DatabaseIcon,
  DoorOpenIcon,
  type IconComponent,
  MonitorIcon,
  RadioIcon,
  ServerIcon,
  ShuffleIcon,
} from '@pkgs/ui';

import type { SimNodeKind } from '../shared/sim-node';

const NODE_ICONS: Readonly<Record<SimNodeKind, IconComponent>> = {
  client: MonitorIcon,
  lb: ShuffleIcon,
  server: ServerIcon,
  events: RadioIcon,
  room: DoorOpenIcon,
  db: DatabaseIcon,
};

export function simNodeIcon(kind: SimNodeKind): IconComponent {
  return NODE_ICONS[kind];
}
