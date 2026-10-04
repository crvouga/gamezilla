import type { HarnessNodeKind } from '@pkgs/harness-console-shared/node';
import type { IconComponent } from '@pkgs/ui-client/create-icon';
import {
  DatabaseIcon,
  DoorOpenIcon,
  MonitorIcon,
  RadioIcon,
  ServerIcon,
  ShuffleIcon,
} from '@pkgs/ui-client/icons';

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
