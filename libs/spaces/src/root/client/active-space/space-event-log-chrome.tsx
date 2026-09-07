/**
 * Spaces wiring for the collaborative event log bar + surface.
 */

import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { useLingui } from '@lingui/solid/macro';
import { type LogLine, projectEventLog } from '@pkgs/collab';
import { EventLogBar, EventLogSurface } from '@pkgs/collab-ui';
import { asLocalized } from '@pkgs/i18n';
import type { RoomActor } from '@pkgs/room';
import { RoomMetaAttr } from '@pkgs/room';
import { useNamedRoomLog } from '@pkgs/room/solid';
import { createMemo, createSignal, type JSX } from 'solid-js';
import {
  SPACE_ROOM_NAME,
  useSpaceRoomSelector,
} from '../../../public/room/use-space-room-selector';
import { useSpaceEventLogRouter } from '../module/space-event-log-router-context';
import { useSpaceParticipantColors } from '../room/use-space-participant-colors';

function renderSpaceEventAvatar(
  actor: RoomActor | null,
  size: number
): JSX.Element {
  if (actor === null) return null;
  return <UserProfileAvatar profileId={actor.id} size={size} />;
}

function renderSpaceEventActorLabel(actor: RoomActor | null): JSX.Element {
  if (actor === null) return null;
  return (
    <UserUsername profileId={actor.id} variant="caption" numberOfLines={1} />
  );
}

export function SpaceEventLogChrome(props: {
  readonly spaceId: string;
}): JSX.Element {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  const entries = useNamedRoomLog(SPACE_ROOM_NAME);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const everSyncedRef = { current: false };
  const everSynced = createMemo(() => {
    if (synced()) everSyncedRef.current = true;
    return everSyncedRef.current;
  });
  const { colorForParticipant } = useSpaceParticipantColors(props.spaceId);
  const router = useSpaceEventLogRouter();

  const lines = createMemo<readonly LogLine[]>(() =>
    projectEventLog(entries(), router)
  );

  const latest = createMemo(() => {
    const current = lines();
    return current.length > 0 ? current[current.length - 1]! : null;
  });

  return (
    <>
      <EventLogBar
        latest={latest()}
        disconnected={!connected()}
        everSynced={everSynced()}
        copy={{
          empty: asLocalized(t`No activity yet`),
          connecting: asLocalized(t`Connecting…`),
          reconnecting: asLocalized(t`Reconnecting…`),
          unreadLabel: (n) => asLocalized(t`${n} new`),
        }}
        colorForActor={(actor) => colorForParticipant(actor.id)}
        renderAvatar={renderSpaceEventAvatar}
        renderActorLabel={renderSpaceEventActorLabel}
        onPress={() => setOpen(true)}
      />
      <EventLogSurface
        visible={open()}
        onClose={() => setOpen(false)}
        lines={lines()}
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
