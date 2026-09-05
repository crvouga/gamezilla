/**
 * Persistent single-line bar showing the latest collaborative event.
 * Press to open a fuller log surface (caller owns that). Unframed: the host
 * decides the surface (card / island) it sits in.
 */

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
import type { ReactNode } from 'react';

import { EventLogIcon } from '../event-log-icon';
import { ParticipantColorRing } from '../participant-color-ring';

export type EventLogBarCopy = {
  readonly empty: LocalizedString;
  /** Shown after a prior successful sync while the socket is down. */
  readonly reconnecting: LocalizedString;
  /** Shown before the first successful sync (initial open). Falls back to reconnecting. */
  readonly connecting?: LocalizedString;
  readonly unreadLabel: (count: number) => LocalizedString;
};

export type EventLogBarProps = {
  latest: LogLine | null;
  disconnected?: boolean;
  /**
   * When true, a prior sync succeeded in this session — disconnect copy uses
   * {@link EventLogBarCopy.reconnecting}. When false, prefer connecting.
   */
  everSynced?: boolean;
  unreadCount?: number;
  copy: EventLogBarCopy;
  colorForActor: (actor: RoomActor) => ParticipantColor | string;
  renderAvatar?: (actor: RoomActor | null, size: number) => ReactNode;
  renderActorLabel?: (actor: RoomActor | null) => ReactNode;
  formatRelativeTime?: (ts: number) => LocalizedString;
  onPress?: () => void;
  dataSet?: ComponentDataSet;
};

const BAR_AVATAR_SIZE = 18;
const BAR_RING_SIZE = 20;

function resolveColor(
  colorForActor: EventLogBarProps['colorForActor'],
  actor: RoomActor | null
): string | null {
  if (actor === null) return null;
  const c = colorForActor(actor);
  return typeof c === 'string' ? c : c.css;
}

function resolveBody(
  disconnected: boolean,
  everSynced: boolean,
  latest: LogLine | null,
  copy: EventLogBarCopy
): LocalizedString {
  if (disconnected) {
    if (!everSynced && copy.connecting !== undefined) return copy.connecting;
    return copy.reconnecting;
  }
  if (latest !== null) return latest.text;
  return copy.empty;
}

function resolveStateKey(
  disconnected: boolean,
  latest: LogLine | null
): string {
  if (disconnected) return 'disconnected';
  if (latest !== null) return `seq-${String(latest.seq)}`;
  return 'empty';
}

function resolveTimeLabel(
  disconnected: boolean,
  latest: LogLine | null,
  formatRelativeTime: EventLogBarProps['formatRelativeTime']
): LocalizedString | null {
  if (disconnected || latest === null || formatRelativeTime === undefined) {
    return null;
  }
  if (latest.ts <= 0) return null;
  return formatRelativeTime(latest.ts);
}

function EventLogBarAvatar({
  actor,
  color,
  renderAvatar,
}: {
  actor: RoomActor | null;
  color: string | null;
  renderAvatar: (actor: RoomActor | null, size: number) => ReactNode;
}): ReactNode {
  const avatar = renderAvatar(actor, BAR_AVATAR_SIZE);
  if (color === null) return avatar;
  return (
    <ParticipantColorRing color={color} size={BAR_RING_SIZE} borderWidth={1.5}>
      {avatar}
    </ParticipantColorRing>
  );
}

function EventLogBarLeading({
  actor,
  color,
  iconName,
  renderAvatar,
}: {
  actor: RoomActor | null;
  color: string | null;
  iconName: string | undefined;
  renderAvatar?: (actor: RoomActor | null, size: number) => ReactNode;
}): ReactNode {
  return (
    <>
      {renderAvatar !== undefined ? (
        <EventLogBarAvatar
          actor={actor}
          color={color}
          renderAvatar={renderAvatar}
        />
      ) : null}
      {iconName !== undefined ? <EventLogIcon name={iconName} /> : null}
    </>
  );
}

function EventLogBarTrailing({
  timeLabel,
  unreadCount,
  unreadLabel,
}: {
  timeLabel: LocalizedString | null;
  unreadCount: number;
  unreadLabel: (count: number) => LocalizedString;
}): ReactNode {
  return (
    <>
      {timeLabel !== null ? (
        <Text
          variant="caption"
          label={timeLabel}
          sx={{ color: 'textSecondary' }}
        />
      ) : null}
      {unreadCount > 0 ? (
        <Text
          variant="caption"
          label={unreadLabel(unreadCount)}
          sx={{ color: 'tint' }}
        />
      ) : null}
    </>
  );
}

function EventLogBarBody({
  body,
  actor,
  renderActorLabel,
}: {
  body: LocalizedString;
  actor: RoomActor | null;
  renderActorLabel?: (actor: RoomActor | null) => ReactNode;
}): ReactNode {
  return (
    <Stack direction="horizontal" spacing={1} align="center">
      {actor !== null && renderActorLabel !== undefined
        ? renderActorLabel(actor)
        : null}
      <Text
        variant="caption"
        numberOfLines={1}
        label={body}
        sx={{ color: 'textSecondary', flexShrink: 1 }}
      />
    </Stack>
  );
}

export function EventLogBar({
  latest,
  disconnected = false,
  everSynced = false,
  unreadCount = 0,
  copy,
  colorForActor,
  renderAvatar,
  renderActorLabel,
  formatRelativeTime,
  onPress,
  dataSet,
}: EventLogBarProps): ReactNode {
  const showIdentity = !disconnected && latest !== null;
  const actor = showIdentity ? latest.actor : null;
  const color = showIdentity ? resolveColor(colorForActor, actor) : null;
  const stateKey = resolveStateKey(disconnected, latest);
  const body = resolveBody(disconnected, everSynced, latest, copy);
  const timeLabel = resolveTimeLabel(disconnected, latest, formatRelativeTime);

  return (
    <Pressable
      {...componentDataSet('EventLogBar', dataSet)}
      onPress={onPress}
      disabled={onPress === undefined}
    >
      <Box sx={{ px: 3, py: 2 }}>
        <Stack
          direction="horizontal"
          spacing={1.5}
          align="center"
          sx={{ minHeight: BAR_RING_SIZE }}
        >
          {showIdentity ? (
            <EventLogBarLeading
              actor={actor}
              color={color}
              iconName={latest.icon}
              {...(renderAvatar !== undefined ? { renderAvatar } : {})}
            />
          ) : null}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FadeSwitch stateKey={stateKey}>
              <EventLogBarBody
                body={body}
                actor={showIdentity ? actor : null}
                {...(renderActorLabel !== undefined
                  ? { renderActorLabel }
                  : {})}
              />
            </FadeSwitch>
          </Box>
          <EventLogBarTrailing
            timeLabel={timeLabel}
            unreadCount={unreadCount}
            unreadLabel={copy.unreadLabel}
          />
        </Stack>
      </Box>
    </Pressable>
  );
}
