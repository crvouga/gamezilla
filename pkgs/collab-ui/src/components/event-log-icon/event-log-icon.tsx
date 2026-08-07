/**
 * Resolve optional LogLine.icon keys to @pkgs/ui icon components.
 */

import {
  CircleCheckIcon,
  DoorOpenIcon,
  Gamepad2Icon,
  type IconComponent,
  LightbulbIcon,
  ListChecksIcon,
  LogInIcon,
  LogOutIcon,
  PlayIcon,
  RotateCcwIcon,
  SquarePenIcon,
  UserIcon,
  XIcon,
} from '@pkgs/ui';
import type { ReactElement } from 'react';

const EVENT_LOG_ICON_MAP: Readonly<Record<string, IconComponent>> = {
  'log-in': LogInIcon,
  'log-out': LogOutIcon,
  'square-pen': SquarePenIcon,
  gamepad: Gamepad2Icon,
  'door-open': DoorOpenIcon,
  play: PlayIcon,
  x: XIcon,
  'rotate-ccw': RotateCcwIcon,
  lightbulb: LightbulbIcon,
  'list-checks': ListChecksIcon,
  user: UserIcon,
  'circle-check': CircleCheckIcon,
};

export function EventLogIcon({
  name,
  size = 14,
}: {
  name: string | undefined;
  size?: number;
}): ReactElement | null {
  if (name === undefined) return null;
  const Icon = EVENT_LOG_ICON_MAP[name];
  if (Icon === undefined) return null;
  return <Icon size={size} />;
}
