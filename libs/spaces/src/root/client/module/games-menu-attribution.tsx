/**
 * Attribution ring around the games picker when the selected game changes.
 */

import { deriveAttribution, projectEventLog } from '@pkgs/collab';
import { AttributionHighlight } from '@pkgs/collab-ui';
import { useNamedRoomLog } from '@pkgs/room';
import { type ReactNode, useCallback, useMemo } from 'react';
import { SPACE_ROOM_NAME } from '../../../public/room/use-space-room-selector';
import { SPACE_LOG_TARGET } from '../../../shared/space/space-log/space-log-router';
import { useSpaceSessionUi } from '../active-space/space-session-ui-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import { useSpaceEventLogRouter } from './space-event-log-router-context';

export function GamesMenuAttribution({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const router = useSpaceEventLogRouter();
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);
  const hit = useMemo(() => {
    const lines = projectEventLog(entries, router);
    return deriveAttribution(lines).get(SPACE_LOG_TARGET.gameSelected) ?? null;
  }, [entries, router]);
  // Stabilize the actor→color callback so AttributionHighlight's render path
  // does not see a new function identity every parent render.
  const colorForActor = useCallback(
    (actorId: string) => colorForParticipant(actorId),
    [colorForParticipant]
  );

  return (
    <AttributionHighlight
      hit={hit}
      colorForActor={colorForActor}
      borderRadius={12}
    >
      {children}
    </AttributionHighlight>
  );
}
