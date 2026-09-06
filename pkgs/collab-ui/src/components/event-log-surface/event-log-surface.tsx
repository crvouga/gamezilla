/**
 * Full event-log surface (sheet / modal) listing projected log lines.
 */

import type { LogLine, ParticipantColor } from '@pkgs/collab';
import { asLocalized, type LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import {
  type ComponentDataSet,
  componentDataAttrs,
  EmptyState,
  ResponsiveSurface,
  ScrollView,
  Text,
} from '@pkgs/ui';
import { createMemo, For, type JSX } from 'solid-js';

import { buildEventLogRows, type EventLogRow } from './build-event-log-rows';
import { EventLogLineRow } from './event-log-line-row';

export type EventLogSurfaceCopy = {
  readonly title: LocalizedString;
  readonly emptyTitle: LocalizedString;
  readonly emptyBody?: LocalizedString;
};

/** Matches space members sheet — keeps long logs scrollable inside the surface. */
const EVENT_LOG_LIST_MAX_HEIGHT = 420;

export type EventLogSurfaceProps = {
  visible: boolean;
  onClose: () => void;
  lines: readonly LogLine[];
  copy: EventLogSurfaceCopy;
  colorForActor: (actor: RoomActor) => ParticipantColor | string;
  renderAvatar: (actor: RoomActor | null, size: number) => JSX.Element;
  renderActorLabel?: (actor: RoomActor | null) => JSX.Element;
  formatTime?: (ts: number) => LocalizedString;
  dataSet?: ComponentDataSet;
};

type RowRenderProps = Pick<
  EventLogSurfaceProps,
  'colorForActor' | 'renderAvatar' | 'renderActorLabel' | 'formatTime'
>;

function resolveColor(
  colorForActor: EventLogSurfaceProps['colorForActor'],
  actor: RoomActor | null
): string | null {
  if (actor === null) return null;
  const c = colorForActor(actor);
  return typeof c === 'string' ? c : c.css;
}

function renderRow(item: EventLogRow, props: RowRenderProps): JSX.Element {
  if (item.kind === 'day') {
    return (
      <Text
        variant="caption"
        label={item.label ?? asLocalized('')}
        sx={{ color: 'textSecondary', py: 2 }}
      />
    );
  }
  const line = item.line!;
  return (
    <EventLogLineRow
      line={line}
      color={resolveColor(props.colorForActor, line.actor)}
      renderAvatar={props.renderAvatar}
      {...(props.renderActorLabel !== undefined
        ? { renderActorLabel: props.renderActorLabel }
        : {})}
      {...(props.formatTime !== undefined
        ? { formatTime: props.formatTime }
        : {})}
    />
  );
}

export function EventLogSurface(props: EventLogSurfaceProps): JSX.Element {
  const rows = createMemo(() => buildEventLogRows(props.lines));

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={props.copy.title}
      size="medium"
      {...componentDataAttrs('EventLogSurface', props.dataSet)}
    >
      {props.lines.length === 0 ? (
        <EmptyState
          title={props.copy.emptyTitle}
          {...(props.copy.emptyBody !== undefined
            ? { body: props.copy.emptyBody }
            : {})}
        />
      ) : (
        <ScrollView frameSx={{ maxHeight: EVENT_LOG_LIST_MAX_HEIGHT }}>
          <For each={[...rows()]}>{(item) => renderRow(item, props)}</For>
        </ScrollView>
      )}
    </ResponsiveSurface>
  );
}
