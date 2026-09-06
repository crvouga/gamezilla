/**
 * Full event-log surface (sheet / modal) listing projected log lines.
 */

import type { LogLine, ParticipantColor } from '@pkgs/collab';
import { asLocalized, type LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import {
  type ComponentDataSet,
  componentDataSet,
  EmptyState,
  FlatList,
  ResponsiveSurface,
  Text,
} from '@pkgs/ui-rn';
import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';

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
  renderAvatar: (actor: RoomActor | null, size: number) => ReactNode;
  renderActorLabel?: (actor: RoomActor | null) => ReactNode;
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

function renderRow(item: EventLogRow, props: RowRenderProps): ReactElement {
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

export function EventLogSurface({
  visible,
  onClose,
  lines,
  copy,
  colorForActor,
  renderAvatar,
  renderActorLabel,
  formatTime,
  dataSet,
}: EventLogSurfaceProps): ReactElement {
  const rows = useMemo(() => buildEventLogRows(lines), [lines]);
  const rowProps: RowRenderProps = {
    colorForActor,
    renderAvatar,
    ...(renderActorLabel !== undefined ? { renderActorLabel } : {}),
    ...(formatTime !== undefined ? { formatTime } : {}),
  };

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={copy.title}
      size="medium"
      {...componentDataSet('EventLogSurface', dataSet)}
    >
      {lines.length === 0 ? (
        <EmptyState
          title={copy.emptyTitle}
          {...(copy.emptyBody !== undefined ? { body: copy.emptyBody } : {})}
        />
      ) : (
        <FlatList
          data={[...rows]}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => renderRow(item, rowProps)}
          frameSx={{ maxHeight: EVENT_LOG_LIST_MAX_HEIGHT }}
        />
      )}
    </ResponsiveSurface>
  );
}
