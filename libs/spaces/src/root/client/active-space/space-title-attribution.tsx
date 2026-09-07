/**
 * Attribution ring around the space title when someone renames it.
 */

import { deriveAttribution, projectEventLog } from '@pkgs/collab';
import { AttributionHighlight } from '@pkgs/collab-ui';
import { useNamedRoomLog } from '@pkgs/room/solid';
import { createMemo, type JSX, type ParentProps } from 'solid-js';
import { SPACE_ROOM_NAME } from '../../../public/room/use-space-room-selector';
import { SPACE_LOG_TARGET } from '../../../shared/space/space-log/space-log-router';
import { useSpaceEventLogRouter } from '../module/space-event-log-router-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';

export function SpaceTitleAttribution(
  props: ParentProps<{ readonly spaceId: string }>
): JSX.Element {
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const router = useSpaceEventLogRouter();
  const { colorForParticipant } = useSpaceParticipantColors(props.spaceId);
  const hit = createMemo(() => {
    const lines = projectEventLog(entries(), router);
    return deriveAttribution(lines).get(SPACE_LOG_TARGET.title) ?? null;
  });
  const colorForActor = (actorId: string) => colorForParticipant(actorId);

  return (
    <AttributionHighlight
      hit={hit()}
      colorForActor={colorForActor}
      borderRadius={6}
    >
      {props.children}
    </AttributionHighlight>
  );
}
