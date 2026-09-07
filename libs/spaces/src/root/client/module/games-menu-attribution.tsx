/**
 * Attribution ring around the games picker when the selected game changes.
 */

import { deriveAttribution, projectEventLog } from '@pkgs/collab';
import { AttributionHighlight } from '@pkgs/collab-ui';
import { useNamedRoomLog } from '@pkgs/room/solid';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { SPACE_ROOM_NAME } from '../../../public/room/use-space-room-selector';
import { SPACE_LOG_TARGET } from '../../../shared/space/space-log/space-log-router';
import { useSpaceSessionUi } from '../active-space/space-session-ui-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import { useSpaceEventLogRouter } from './space-event-log-router-context';

export function GamesMenuAttribution(props: {
  children: JSX.Element;
}): JSX.Element {
  const { spaceId } = useSpaceSessionUi();
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const router = useSpaceEventLogRouter();
  const colors = useSpaceParticipantColors(spaceId);
  const hit = createMemo(() => {
    const lines = projectEventLog(entries(), router);
    return deriveAttribution(lines).get(SPACE_LOG_TARGET.gameSelected) ?? null;
  });
  const colorForActor = (actorId: string) =>
    colors.colorForParticipant(actorId);

  return (
    <AttributionHighlight
      hit={hit()}
      colorForActor={colorForActor}
      borderRadius={12}
    >
      {props.children}
    </AttributionHighlight>
  );
}
