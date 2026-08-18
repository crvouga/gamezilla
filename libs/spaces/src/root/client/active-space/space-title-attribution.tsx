/**
 * Attribution ring around the space title when someone renames it.
 */

import { deriveAttribution, projectEventLog } from '@pkgs/collab';
import { AttributionHighlight } from '@pkgs/collab-ui';
import { useNamedRoomLog } from '@pkgs/room';
import { type ReactNode, useCallback, useMemo } from 'react';
import { SPACE_ROOM_NAME } from '../../../public/room/use-space-room-selector';
import { SPACE_LOG_TARGET } from '../../../shared/space/space-log/space-log-router';
import { useSpaceEventLogRouter } from '../module/space-event-log-router-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';

export function SpaceTitleAttribution({
  spaceId,
  children,
}: {
  spaceId: string;
  children: ReactNode;
}): ReactNode {
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const router = useSpaceEventLogRouter();
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);
  const hit = useMemo(() => {
    const lines = projectEventLog(entries, router);
    return deriveAttribution(lines).get(SPACE_LOG_TARGET.title) ?? null;
  }, [entries, router]);
  const colorForActor = useCallback(
    (actorId: string) => colorForParticipant(actorId),
    [colorForParticipant]
  );

  return (
    <AttributionHighlight
      hit={hit}
      colorForActor={colorForActor}
      borderRadius={6}
    >
      {children}
    </AttributionHighlight>
  );
}
