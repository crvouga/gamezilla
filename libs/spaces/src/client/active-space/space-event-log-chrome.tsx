/**
 * Spaces wiring for the collaborative event log bar + surface.
 */

import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { projectEventLog, type LogLine } from '@pkgs/collab';
import { EventLogBar, EventLogSurface } from '@pkgs/collab-ui';
import { asLocalized } from '@pkgs/i18n';
import { RoomMetaAttr, useNamedRoomLog, useRoomFromRegistry } from '@pkgs/room';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState, type ReactNode } from 'react';

import { createSpaceEventLogRouter } from '../../shared/space-log/space-log-router';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from '../room/use-space-room-selector';

const SPACE_EVENT_LOG_ROUTER = createSpaceEventLogRouter();

export function SpaceEventLogChrome({
  spaceId,
}: {
  spaceId: string;
}): ReactNode {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const disconnected = !useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);

  const lines: readonly LogLine[] = useMemo(
    () => projectEventLog(entries, SPACE_EVENT_LOG_ROUTER),
    [entries]
  );

  const latest = lines.length > 0 ? lines[lines.length - 1]! : null;

  if (room === null) return null;

  return (
    <>
      <EventLogBar
        latest={latest}
        disconnected={disconnected}
        copy={{
          empty: asLocalized(t`No activity yet`),
          reconnecting: asLocalized(t`Reconnecting…`),
          unreadLabel: (n) => asLocalized(t`${n} new`),
        }}
        colorForActor={(actor) => colorForParticipant(actor.id)}
        onPress={() => setOpen(true)}
      />
      <EventLogSurface
        visible={open}
        onClose={() => setOpen(false)}
        lines={lines}
        copy={{
          title: asLocalized(t`Activity`),
          emptyTitle: asLocalized(t`No activity yet`),
          emptyBody: asLocalized(
            t`Joins, leaves, and game changes will show up here.`
          ),
        }}
        colorForActor={(actor) => colorForParticipant(actor.id)}
        renderAvatar={(actor, size) =>
          actor !== null ? (
            <UserProfileAvatar profileId={actor.id} size={size} />
          ) : null
        }
      />
    </>
  );
}
