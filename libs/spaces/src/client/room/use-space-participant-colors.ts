import {
  assignParticipantColors,
  type ParticipantColor,
  resolveParticipantColor,
} from '@pkgs/collab';
import { useRoomFromRegistry, useRoomRoster } from '@pkgs/room';
import { useCallback, useMemo } from 'react';

import { SPACE_ROOM_NAME } from './use-space-room-selector';

/**
 * Stable participant colors from the live roster. Offline / unknown ids still
 * get a deterministic color via {@link resolveParticipantColor} on demand —
 * avoids extra sync watches on the hot presence/log path (those watches
 * were contributing to max-update-depth storms on native).
 */
export function useSpaceParticipantColors(_spaceId: string): {
  colorForParticipant: (participantId: string) => ParticipantColor;
  colorsById: ReadonlyMap<string, ParticipantColor>;
} {
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const roster = useRoomRoster(room);

  const colorsById = useMemo(() => {
    const keys = roster.map((c) => c.id);
    return assignParticipantColors(keys);
  }, [roster]);

  const colorForParticipant = useCallback(
    (participantId: string): ParticipantColor => {
      const existing = colorsById.get(participantId);
      if (existing !== undefined) return existing;
      return resolveParticipantColor(participantId);
    },
    [colorsById]
  );

  return { colorForParticipant, colorsById };
}
