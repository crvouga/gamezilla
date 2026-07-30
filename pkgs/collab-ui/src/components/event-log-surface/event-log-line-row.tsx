import type { LogLine } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import { Stack, Text } from '@pkgs/ui';
import type { ReactElement, ReactNode } from 'react';

import { EventLogIcon } from '../event-log-icon';
import { ParticipantColorRing } from '../participant-color-ring';

export type EventLogLineRowProps = {
  line: LogLine;
  color: string | null;
  renderAvatar: (actor: RoomActor | null, size: number) => ReactNode;
  renderActorLabel?: (actor: RoomActor | null) => ReactNode;
  formatTime?: (ts: number) => LocalizedString;
};

function EventLogLineBody({
  line,
  renderActorLabel,
}: {
  line: LogLine;
  renderActorLabel?: (actor: RoomActor | null) => ReactNode;
}): ReactElement {
  return (
    <Stack direction="horizontal" spacing={1} align="center">
      <EventLogIcon name={line.icon} size={16} />
      {line.actor !== null && renderActorLabel !== undefined
        ? renderActorLabel(line.actor)
        : null}
      <Text
        variant="body"
        label={line.text}
        numberOfLines={3}
        sx={{ flexShrink: 1 }}
      />
    </Stack>
  );
}

export function EventLogLineRow({
  line,
  color,
  renderAvatar,
  renderActorLabel,
  formatTime,
}: EventLogLineRowProps): ReactElement {
  const time =
    formatTime !== undefined && line.ts > 0 ? formatTime(line.ts) : null;
  return (
    <Stack direction="horizontal" spacing={2} align="center" sx={{ py: 2 }}>
      {color !== null ? (
        <ParticipantColorRing color={color} size={36} borderWidth={2}>
          {renderAvatar(line.actor, 32)}
        </ParticipantColorRing>
      ) : (
        renderAvatar(line.actor, 32)
      )}
      <Stack spacing={0.5} style={{ flex: 1, minWidth: 0 }}>
        <EventLogLineBody
          line={line}
          {...(renderActorLabel !== undefined ? { renderActorLabel } : {})}
        />
        {time !== null ? (
          <Text
            variant="caption"
            label={time}
            sx={{ color: 'textSecondary' }}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}
