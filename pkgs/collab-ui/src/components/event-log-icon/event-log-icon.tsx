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
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

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

export function EventLogIcon(props: {
  name: string | undefined;
  size?: number;
}): JSX.Element {
  const icon = () => EVENT_LOG_ICON_MAP[props.name ?? ''];
  return (
    <Show when={icon()}>
      {(Icon) => <Dynamic component={Icon()} size={props.size ?? 14} />}
    </Show>
  );
}
