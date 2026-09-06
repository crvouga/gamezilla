import type { LogLine, ParticipantColor } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import {
  Box,
  type ComponentDataSet,
  componentDataSet,
  FadeSwitch,
  Pressable,
  Stack,
  Text,
} from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';
import { EventLogIcon } from '../event-log-icon';
import { ParticipantColorRing } from '../participant-color-ring';

export type EventLogBarCopy = {
  readonly empty: LocalizedString;
  readonly reconnecting: LocalizedString;
  readonly connecting?: LocalizedString;
  readonly unreadLabel: (count: number) => LocalizedString;
};

export type EventLogBarProps = {
  latest: LogLine | null;
  disconnected?: boolean;
  everSynced?: boolean;
  unreadCount?: number;
  copy: EventLogBarCopy;
  colorForActor: (actor: RoomActor) => ParticipantColor | string;
  renderAvatar?: (actor: RoomActor | null, size: number) => JSX.Element;
  renderActorLabel?: (actor: RoomActor | null) => JSX.Element;
  formatRelativeTime?: (ts: number) => LocalizedString;
  onPress?: () => void;
  dataSet?: ComponentDataSet;
};

function EventLogBarIdentity(props: {
  line: LogLine;
  bar: EventLogBarProps;
}): JSX.Element {
  const color = () => {
    if (props.line.actor === null) return null;
    const value = props.bar.colorForActor(props.line.actor);
    return typeof value === 'string' ? value : value.css;
  };
  return (
    <>
      <Show when={props.bar.renderAvatar}>
        <Show
          when={color()}
          fallback={props.bar.renderAvatar?.(props.line.actor, 18)}
        >
          {(ringColor) => (
            <ParticipantColorRing
              color={ringColor()}
              size={20}
              borderWidth={1.5}
            >
              {props.bar.renderAvatar?.(props.line.actor, 18)}
            </ParticipantColorRing>
          )}
        </Show>
      </Show>
      <EventLogIcon name={props.line.icon} />
    </>
  );
}

/** The host owns the surface; this bar preserves connection, identity and unread state. */
export function EventLogBar(props: EventLogBarProps): JSX.Element {
  const line = () => (props.disconnected ? null : props.latest);
  const body = () => {
    if (props.disconnected) {
      return !props.everSynced
        ? (props.copy.connecting ?? props.copy.reconnecting)
        : props.copy.reconnecting;
    }
    return props.latest?.text ?? props.copy.empty;
  };
  const stateKey = () =>
    props.disconnected
      ? 'disconnected'
      : props.latest
        ? `seq-${props.latest.seq}`
        : 'empty';
  const timeLabel = () => {
    const latest = line();
    return latest && latest.ts > 0
      ? props.formatRelativeTime?.(latest.ts)
      : null;
  };
  return (
    <Pressable
      {...componentDataSet('EventLogBar', props.dataSet)}
      onPress={props.onPress}
      disabled={props.onPress === undefined}
    >
      <Box sx={{ minWidth: 0, py: 0.5 }}>
        <Stack
          direction="horizontal"
          spacing={1.5}
          align="center"
          sx={{ minHeight: 20 }}
        >
          <Show when={line()}>
            {(latest) => <EventLogBarIdentity line={latest()} bar={props} />}
          </Show>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FadeSwitch stateKey={stateKey()}>
              <Stack direction="horizontal" spacing={1} align="center">
                {line()?.actor ? props.renderActorLabel?.(line()!.actor) : null}
                <Text
                  variant="caption"
                  numberOfLines={1}
                  label={body()}
                  sx={{ color: 'textSecondary', flexShrink: 1 }}
                />
              </Stack>
            </FadeSwitch>
          </Box>
          <Show when={timeLabel()}>
            {(label) => (
              <Text
                variant="caption"
                label={label()}
                sx={{ color: 'textSecondary' }}
              />
            )}
          </Show>
          <Show when={(props.unreadCount ?? 0) > 0}>
            <Text
              variant="caption"
              label={props.copy.unreadLabel(props.unreadCount ?? 0)}
              sx={{ color: 'tint' }}
            />
          </Show>
        </Stack>
      </Box>
    </Pressable>
  );
}
