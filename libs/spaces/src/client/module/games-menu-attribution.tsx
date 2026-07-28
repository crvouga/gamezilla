/**
 * Attribution ring around the games picker when the selected game changes.
 */

import { AttributionHighlight } from '@pkgs/collab-ui';
import { deriveAttribution, projectEventLog } from '@pkgs/collab';
import { useNamedRoomLog } from '@pkgs/room';
import { useCallback, useMemo, type ReactNode } from 'react';

import {
  createSpaceEventLogRouter,
  SPACE_LOG_TARGET,
} from '../../shared/space-log/space-log-router';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import { SPACE_ROOM_NAME } from '../room/use-space-room-selector';
import { useSpaceSessionUi } from '../active-space/space-session-ui-context';

const ROUTER = createSpaceEventLogRouter();

export function GamesMenuAttribution({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);
  const hit = useMemo(() => {
    const lines = projectEventLog(entries, ROUTER);
    return deriveAttribution(lines).get(SPACE_LOG_TARGET.gameSelected) ?? null;
  }, [entries]);
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
