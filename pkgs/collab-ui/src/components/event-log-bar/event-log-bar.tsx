/**
 * Persistent single-line bar showing the latest collaborative event.
 * Press to open a fuller log surface (caller owns that).
 */

import type { LogLine, ParticipantColor } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import {
  Box,
  FadeSwitch,
  Pressable,
  Stack,
  Text,
  componentDataSet,
  type ComponentDataSet,
  useTheme,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ParticipantDot } from '../participant-dot';

export type EventLogBarCopy = {
  readonly empty: LocalizedString;
  readonly reconnecting: LocalizedString;
  readonly unreadLabel: (count: number) => LocalizedString;
};

export type EventLogBarProps = {
  latest: LogLine | null;
  disconnected?: boolean;
  unreadCount?: number;
  copy: EventLogBarCopy;
  colorForActor: (actor: RoomActor) => ParticipantColor | string;
  formatRelativeTime?: (ts: number) => LocalizedString;
  onPress?: () => void;
  dataSet?: ComponentDataSet;
};

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
  latest: LogLine | null,
  copy: EventLogBarCopy
): LocalizedString {
  if (disconnected) return copy.reconnecting;
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

export function EventLogBar({
  latest,
  disconnected = false,
  unreadCount = 0,
  copy,
  colorForActor,
  formatRelativeTime,
  onPress,
  dataSet,
}: EventLogBarProps): ReactNode {
  const theme = useTheme();
  const color = resolveColor(colorForActor, latest?.actor ?? null);
  const stateKey = resolveStateKey(disconnected, latest);
  const body = resolveBody(disconnected, latest, copy);
  const timeLabel = resolveTimeLabel(disconnected, latest, formatRelativeTime);

  return (
    <Pressable
      {...componentDataSet('EventLogBar', dataSet)}
      onPress={onPress}
      disabled={onPress === undefined}
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Box sx={{ px: 3, py: 2 }}>
        <Stack direction="horizontal" spacing={2} align="center">
          {color !== null ? <ParticipantDot color={color} /> : null}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FadeSwitch stateKey={stateKey}>
              <Text
                variant="caption"
                numberOfLines={1}
                label={body}
                sx={{ color: 'textSecondary' }}
              />
            </FadeSwitch>
          </Box>
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
              label={copy.unreadLabel(unreadCount)}
              sx={{ color: 'tint' }}
            />
          ) : null}
        </Stack>
      </Box>
    </Pressable>
  );
}
