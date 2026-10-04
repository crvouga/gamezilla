import { DatabaseIcon, DoorOpenIcon, MonitorIcon, RadioIcon, ServerIcon, ShuffleIcon } from '@pkgs/ui-client/icons';
import type { IconComponent } from '@pkgs/ui-client/create-icon';

import type { HarnessNodeKind } from '@pkgs/harness-console-shared/node';

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
