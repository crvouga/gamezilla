/**
 * Spaces wiring for the collaborative event log bar + surface.
 */

import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { UserUsername } from '@libs/profile/client/user-username';
import { projectEventLog, type LogLine } from '@pkgs/collab';
import { EventLogBar, EventLogSurface } from '@pkgs/collab-ui';
import { asLocalized } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import { RoomMetaAttr, useNamedRoomLog } from '@pkgs/room';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState, type ReactNode } from 'react';

import { useSpaceEventLogRouter } from '../module/space-event-log-router-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from '../room/use-space-room-selector';

function renderSpaceEventAvatar(
  actor: RoomActor | null,
  size: number
): ReactNode {
  if (actor === null) return null;
  return <UserProfileAvatar profileId={actor.id} size={size} />;
}

function renderSpaceEventActorLabel(actor: RoomActor | null): ReactNode {
  if (actor === null) return null;
  return (
    <UserUsername profileId={actor.id} variant="caption" numberOfLines={1} />
  );
}

export function SpaceEventLogChrome({
  spaceId,
}: {
  spaceId: string;
}): ReactNode {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const disconnected = !useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const { colorForParticipant } = useSpaceParticipantColors(spaceId);
  const router = useSpaceEventLogRouter();

  const lines: readonly LogLine[] = useMemo(
    () => projectEventLog(entries, router),
    [entries, router]
  );

  const latest = lines.length > 0 ? lines[lines.length - 1]! : null;

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
        renderAvatar={renderSpaceEventAvatar}
        renderActorLabel={renderSpaceEventActorLabel}
        onPress={() => setOpen(true)}
      />
      <EventLogSurface
        visible={open}
        onClose={() => setOpen(false)}
        lines={lines}
        copy={{
          title: asLocalized(t`Game log`),
          emptyTitle: asLocalized(t`No activity yet`),
          emptyBody: asLocalized(
            t`Joins, leaves, and game play will show up here.`
          ),
        }}
        colorForActor={(actor) => colorForParticipant(actor.id)}
        renderAvatar={renderSpaceEventAvatar}
        renderActorLabel={renderSpaceEventActorLabel}
      />
    </>
  );
}
