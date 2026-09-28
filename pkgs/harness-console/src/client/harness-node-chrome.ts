import {
  DatabaseIcon,
  DoorOpenIcon,
  type IconComponent,
  MonitorIcon,
  RadioIcon,
  ServerIcon,
  ShuffleIcon,
} from '@pkgs/ui';

import type { HarnessNodeKind } from '../shared/harness-node';

const NODE_ICONS: Readonly<Record<HarnessNodeKind, IconComponent>> = {
  client: MonitorIcon,
  lb: ShuffleIcon,
  server: ServerIcon,
  events: RadioIcon,
  room: DoorOpenIcon,
  db: DatabaseIcon,
};

export function harnessNodeIcon(kind: HarnessNodeKind): IconComponent {
  return NODE_ICONS[kind];
}
