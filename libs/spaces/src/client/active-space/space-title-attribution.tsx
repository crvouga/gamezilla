/**
 * Attribution ring around the space title when someone renames it.
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

const ROUTER = createSpaceEventLogRouter();

export function SpaceTitleAttribution({
  spaceId,
  children,
}: {
  spaceId: string;
  children: ReactNode;
}): ReactNode {
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);
  const hit = useMemo(() => {
    const lines = projectEventLog(entries, ROUTER);
    return deriveAttribution(lines).get(SPACE_LOG_TARGET.title) ?? null;
  }, [entries]);
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
