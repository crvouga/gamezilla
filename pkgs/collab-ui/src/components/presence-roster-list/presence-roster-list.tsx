/**
 * Roster list: one row per connected client.
 */

import type { ParticipantColor } from '@pkgs/collab';
import type { LocalizedString } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import {
  List,
  ListItem,
  StatusDot,
  Stack,
  componentDataSet,
  type ComponentDataSet,
} from '@pkgs/ui';
import type { ReactElement, ReactNode } from 'react';

import { ParticipantColorRing } from '../participant-color-ring';

export type PresenceRosterRow = {
  readonly client: RoomActor;
  readonly title: LocalizedString;
  readonly subtitle?: LocalizedString;
  readonly isYou?: boolean;
  readonly isThisTab?: boolean;
  readonly isHost?: boolean;
  readonly badges?: ReactNode;
};

export type PresenceRosterListProps = {
  rows: readonly PresenceRosterRow[];
  colorForParticipant: (participantId: string) => ParticipantColor | string;
  renderAvatar: (actor: RoomActor, size: number) => ReactNode;
  dataSet?: ComponentDataSet;
};

function resolveColor(
  colorForParticipant: PresenceRosterListProps['colorForParticipant'],
  participantId: string
): string {
  const c = colorForParticipant(participantId);
  return typeof c === 'string' ? c : c.css;
}

export function PresenceRosterList({
  rows,
  colorForParticipant,
  renderAvatar,
  dataSet,
}: PresenceRosterListProps): ReactElement {
  return (
    <List {...componentDataSet('PresenceRosterList', dataSet)}>
      {rows.map((row) => (
        <ListItem
          key={row.client.clientId}
          title={row.title}
          {...(row.subtitle !== undefined ? { subtitle: row.subtitle } : {})}
          leading={
            <Stack direction="horizontal" spacing={2} align="center">
              <ParticipantColorRing
                color={resolveColor(colorForParticipant, row.client.id)}
                size={40}
                borderWidth={2}
              >
                {renderAvatar(row.client, 36)}
              </ParticipantColorRing>
              <StatusDot status="online" size={8} />
            </Stack>
          }
          trailing={row.badges}
        />
      ))}
    </List>
  );
}
