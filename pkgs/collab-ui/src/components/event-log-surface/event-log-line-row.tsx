import type { LogLine } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
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
    <div class="box flex-row gap-2 items-center py-2">
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
      <div class="box flex-col gap-0.5 flex-1 min-w-[0]">
        <div class="box flex-row gap-1 items-center">
          <EventLogIcon name={props.line.icon} size={16} />
          {props.line.actor !== null
            ? props.renderActorLabel?.(props.line.actor)
            : null}
          <p class="text line-clamp-3 shrink">{props.line.text}</p>
        </div>
        <Show when={time()}>
          {(label) => (
            <p class="text textCaption text-text-secondary">{label()}</p>
          )}
        </Show>
      </div>
    </div>
  );
}
