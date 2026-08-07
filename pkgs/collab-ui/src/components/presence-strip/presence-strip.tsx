/**
 * Presence strip: one face per connected client, ringed in participant color.
 */

import type { ParticipantColor } from '@pkgs/collab';
import type { RoomActor } from '@pkgs/room';
import { AvatarGroup, type ComponentDataSet, componentDataSet } from '@pkgs/ui';
import type { ReactElement, ReactNode } from 'react';

import { ParticipantColorRing } from '../participant-color-ring';

export type PresenceStripProps = {
  /** Flat per-client roster (same order as the server snapshot). */
  clients: readonly RoomActor[];
  colorForParticipant: (participantId: string) => ParticipantColor | string;
  renderAvatar: (actor: RoomActor, size: number) => ReactNode;
  size?: number;
  maxVisible?: number;
  onPress?: () => void;
  dataSet?: ComponentDataSet;
};

function resolveColor(
  colorForParticipant: PresenceStripProps['colorForParticipant'],
  participantId: string
): string {
  const c = colorForParticipant(participantId);
  return typeof c === 'string' ? c : c.css;
}

export function PresenceStrip({
  clients,
  colorForParticipant,
  renderAvatar,
  size = 32,
  maxVisible = 5,
  onPress,
  dataSet,
}: PresenceStripProps): ReactElement {
  const ringSize = size + 4;
  return (
    <AvatarGroup
      size={ringSize}
      maxVisible={maxVisible}
      {...(onPress !== undefined ? { onPress } : {})}
      {...componentDataSet('PresenceStrip', dataSet)}
    >
      {clients.map((client) => (
        <ParticipantColorRing
          key={client.clientId}
          color={resolveColor(colorForParticipant, client.id)}
          size={ringSize}
          borderWidth={2}
        >
          {renderAvatar(client, size)}
        </ParticipantColorRing>
      ))}
    </AvatarGroup>
  );
}
