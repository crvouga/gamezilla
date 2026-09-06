import type { LogLine } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import { Stack, Text } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';
import { EventLogIcon } from '../event-log-icon';
import { ParticipantColorRing } from '../participant-color-ring';

export type EventLogLineRowProps = {
  line: LogLine;
  color: string | null;
  renderAvatar: (actor: RoomActor | null, size: number) => JSX.Element;
  renderActorLabel?: (actor: RoomActor | null) => JSX.Element;
  formatTime?: (ts: number) => LocalizedString;
};

export function EventLogLineRow(props: EventLogLineRowProps): JSX.Element {
  const time = () =>
    props.line.ts > 0 ? props.formatTime?.(props.line.ts) : null;
  return (
    <Stack direction="horizontal" spacing={2} align="center" sx={{ py: 2 }}>
      <Show
        when={props.color}
        fallback={props.renderAvatar(props.line.actor, 32)}
      >
        {(color) => (
          <ParticipantColorRing color={color()} size={36} borderWidth={2}>
            {props.renderAvatar(props.line.actor, 32)}
          </ParticipantColorRing>
        )}
      </Show>
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="horizontal" spacing={1} align="center">
          <EventLogIcon name={props.line.icon} size={16} />
          {props.line.actor !== null
            ? props.renderActorLabel?.(props.line.actor)
            : null}
          <Text
            variant="body"
            label={props.line.text}
            numberOfLines={3}
            sx={{ flexShrink: 1 }}
          />
        </Stack>
        <Show when={time()}>
          {(label) => (
            <Text
              variant="caption"
              label={label()}
              sx={{ color: 'textSecondary' }}
            />
          )}
        </Show>
      </Stack>
    </Stack>
  );
}
