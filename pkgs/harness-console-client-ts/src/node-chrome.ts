import type { HarnessNodeKind } from '@pkgs/harness-console-shared-ts/node';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  DatabaseIcon,
  DoorOpenIcon,
  MonitorIcon,
  RadioIcon,
  ServerIcon,
  ShuffleIcon,
} from '@pkgs/ui-root-client-ts/icons';

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
