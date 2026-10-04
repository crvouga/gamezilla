import { assignParticipantColors, resolveParticipantColor } from '@pkgs/collab-shared/participant-color';
import type { ParticipantColor } from '@pkgs/collab-shared/participant-color';
import { useNamedRoomRoster } from '@pkgs/room-client/room-clients-context';
import { type Accessor, createMemo } from 'solid-js';

import { SPACE_ROOM_NAME } from './use-space-room-selector';

/**
 * Stable participant colors from the live roster. Offline / unknown ids still
 * get a deterministic color via {@link resolveParticipantColor} on demand —
 * avoids extra sync watches on the hot presence/log path (those watches
 * were contributing to max-update-depth storms on native).
 */
export function useSpaceParticipantColors(
  _spaceId: string | Accessor<string>
): {
  colorForParticipant: (participantId: string) => ParticipantColor;
  colorsById: Accessor<ReadonlyMap<string, ParticipantColor>>;
} {
  const roster = useNamedRoomRoster(SPACE_ROOM_NAME);

  const colorsById = createMemo(() => {
    const keys = roster().map((c) => c.id);
    return assignParticipantColors(keys);
  });

  const colorForParticipant = (participantId: string): ParticipantColor => {
    const existing = colorsById().get(participantId);
    if (existing !== undefined) return existing;
    return resolveParticipantColor(participantId);
  };

  return { colorForParticipant, colorsById };
}
