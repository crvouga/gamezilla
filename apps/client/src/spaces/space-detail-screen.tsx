import { useMyId } from '@gamezilla/client/auth/auth-context';
import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { SpaceCounterPanel } from '@gamezilla/client/spaces/space-counter-panel';
import { SpaceRoomWireContext } from '@gamezilla/client/spaces/space-room-wire-context';
import { useSpaceRoom } from '@gamezilla/client/spaces/use-space-room';
import { SpaceDebugModal } from '@gamezilla/client/spaces/space-debug-modal';
import { SpaceMemberList } from '@gamezilla/client/spaces/space-member-list';
import {
  useCurrentSpaces,
  useSpace,
  useSpaceMembers,
} from '@gamezilla/client/spaces/use-spaces';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { spaceGuestMembershipEntityId } from '@gamezilla/domain/spaces/membership-key';
import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQuery } from '@gamezilla/patch-db/react';
import {
  Box,
  Button,
  Center,
  ConfirmationModal,
  ScreenBase,
  Spinner,
  Text,
  type ScreenBaseAction,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

const NO_ENTITY_PLACEHOLDER = '__patch_db_no_entity__';

type Space = ReturnType<typeof useSpace>;

function readMembershipString(
  attrs: Record<string, unknown> | undefined,
  key: string
): string | null {
  if (!attrs) return null;
  const v = attrs[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function useAutoLeaveIfEnded(args: {
  spaceId: string | undefined;
  space: Space;
  myId: string;
  leaveSpace: (spaceId: string) => Promise<void> | void;
}) {
  const { spaceId, space, myId, leaveSpace } = args;
  const memEntityId =
    spaceId && myId
      ? spaceGuestMembershipEntityId(myId, spaceId)
      : NO_ENTITY_PLACEHOLDER;

  const memRes = useQuery(
    memEntityId === NO_ENTITY_PLACEHOLDER
      ? { entityType: SPACE_MEMBERSHIP_ENTITY_TYPE, limit: 0 }
      : {
          entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
          entityId: memEntityId,
        }
  );
  const membership = memRes.entities[0] ?? null;
  const membershipSpaceId = readMembershipString(
    membership?.attributes as Record<string, unknown> | undefined,
    SpaceMembershipAttr.spaceId
  );
  const membershipLeftAt =
    membership?.attributes[SpaceMembershipAttr.leftAt];

  useEffect(() => {
    if (!spaceId || !space.space || space.live) return;
    const left = membershipLeftAt !== undefined && membershipLeftAt !== null;
    if (membershipSpaceId === spaceId && !left) {
      void leaveSpace(spaceId);
    }
  }, [
    spaceId,
    space.space,
    space.live,
    membershipSpaceId,
    membershipLeftAt,
    leaveSpace,
  ]);
}

function useDebugAction(onOpenDebug: () => void): ScreenBaseAction[] {
  const { t } = useLingui();
  return useMemo(
    () => [
      {
        type: 'default',
        label: t`Debug`,
        icon: 'chevron.left.forwardslash.chevron.right',
        onPress: onOpenDebug,
        overflow: 'auto',
      },
    ],
    [onOpenDebug, t]
  );
}

function JoinPrompt({
  spaceId,
  title,
  hostLabel,
  joinBlocked,
  onJoin,
  onOpenDebug,
}: {
  spaceId: string | undefined;
  title: string;
  hostLabel: string;
  joinBlocked: boolean;
  onJoin: (id: string) => Promise<void> | void;
  onOpenDebug: () => void;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const actions = useDebugAction(onOpenDebug);
  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: title },
      ]}
      actions={actions}
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          <Text
            variant="label"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Host</Trans>}
          />
          <Text variant="bodyBold" label={hostLabel} />
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={
              <Trans>Join this space to see who is here and hang out.</Trans>
            }
          />
          {joinBlocked ? (
            <Text
              variant="body"
              sx={{ color: 'textSecondary' }}
              label={<Trans>You're already in a space</Trans>}
            />
          ) : null}
          <Button
            title={t`Join space`}
            variant="solid"
            disabled={joinBlocked}
            onPress={() => {
              if (spaceId) void onJoin(spaceId);
            }}
          />
          <Button
            title={t`Back`}
            variant="outlined"
            onPress={() => router.back()}
          />
        </Box>
      )}
    />
  );
}

function EndSpaceModal({
  visible,
  onClose,
  onEnd,
}: {
  visible: boolean;
  onClose: () => void;
  onEnd: () => void;
}) {
  return (
    <ConfirmationModal
      visible={visible}
      title={<Trans>End space?</Trans>}
      message={
        <Trans>Everyone will leave this space. This cannot be undone.</Trans>
      }
      confirmLabel={<Trans>End space</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      variant="destructive"
      onConfirm={onEnd}
      onCancel={onClose}
    />
  );
}

function LeaveSpaceModal({
  visible,
  onClose,
  onLeave,
}: {
  visible: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  return (
    <ConfirmationModal
      visible={visible}
      title={<Trans>Leave space?</Trans>}
      message={
        <Trans>You can join again later if the space is still live.</Trans>
      }
      confirmLabel={<Trans>Leave</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      variant="default"
      onConfirm={onLeave}
      onCancel={onClose}
    />
  );
}

function ActiveSpaceBody({
  spaceId,
  isHost,
  members,
  onRequestEnd,
  onRequestLeave,
}: {
  spaceId: string | undefined;
  isHost: boolean;
  members: ReturnType<typeof useSpaceMembers>['members'];
  onRequestEnd: () => void;
  onRequestLeave: () => void;
}) {
  const { t } = useLingui();
  const room = useSpaceRoom(spaceId);
  return (
    <SpaceRoomWireContext.Provider
      value={{
        transport: room.transport,
        roomActive: room.roomActive,
        roomSynced: room.isSynced,
      }}
    >
      <SpaceCounterPanel room={room} />
      <SpaceMemberList members={members} />
      {isHost ? (
        <Button title={t`End space`} variant="solid" onPress={onRequestEnd} />
      ) : (
        <Button
          title={t`Leave space`}
          variant="outlined"
          onPress={onRequestLeave}
        />
      )}
    </SpaceRoomWireContext.Provider>
  );
}

function ActiveSpace({
  spaceId,
  space,
  isHost,
  members,
  endSpace,
  leaveSpace,
  onOpenDebug,
}: {
  spaceId: string | undefined;
  space: Space;
  isHost: boolean;
  members: ReturnType<typeof useSpaceMembers>['members'];
  endSpace: (id: string) => Promise<void> | void;
  leaveSpace: (id: string) => Promise<void> | void;
  onOpenDebug: () => void;
}) {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const actions = useDebugAction(onOpenDebug);

  const handleEnd = () => {
    setConfirmEnd(false);
    void (async () => {
      if (spaceId) await endSpace(spaceId);
      router.back();
    })();
  };
  const handleLeave = () => {
    setConfirmLeave(false);
    if (spaceId) void leaveSpace(spaceId);
    router.back();
  };

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: space.title },
      ]}
      actions={actions}
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 4 }}>
          <ActiveSpaceBody
            spaceId={spaceId}
            isHost={isHost}
            members={members}
            onRequestEnd={() => setConfirmEnd(true)}
            onRequestLeave={() => setConfirmLeave(true)}
          />
          <EndSpaceModal
            visible={confirmEnd}
            onClose={() => setConfirmEnd(false)}
            onEnd={handleEnd}
          />
          <LeaveSpaceModal
            visible={confirmLeave}
            onClose={() => setConfirmLeave(false)}
            onLeave={handleLeave}
          />
        </Box>
      )}
    />
  );
}

function SpaceLoading() {
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Spaces</Trans>, onPress: nav('/') }]}
      content={({ sx }) => (
        <Center style={sx} sx={{ flex: 1 }}>
          <Spinner size="large" />
        </Center>
      )}
    />
  );
}

export function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = typeof id === 'string' ? id : undefined;

  const space = useSpace(spaceId);
  const currentSpaces = useCurrentSpaces();
  const { members } = useSpaceMembers(spaceId);
  const { joinSpace, leaveSpace, endSpace } = useSpaceActions();
  const myId = useMyId();
  const [debugOpen, setDebugOpen] = useState(false);
  const openDebug = () => setDebugOpen(true);
  const closeDebug = () => setDebugOpen(false);

  useAutoLeaveIfEnded({ spaceId, space, myId, leaveSpace });

  const debugModal = (
    <SpaceDebugModal
      visible={debugOpen}
      onClose={closeDebug}
      spaceId={spaceId}
      space={space}
      currentSpaces={currentSpaces}
      members={members}
    />
  );

  if (space.isLoading || currentSpaces.isLoading) {
    return <SpaceLoading />;
  }

  const inThisSpace = currentSpaces.entries.some((e) => e.spaceId === spaceId);
  const entryForSpace = currentSpaces.entries.find((e) => e.spaceId === spaceId);

  if (!inThisSpace) {
    const joinBlocked =
      currentSpaces.entries.length > 0 &&
      !currentSpaces.entries.some((e) => e.spaceId === spaceId);
    return (
      <>
        <JoinPrompt
          spaceId={spaceId}
          title={space.title}
          hostLabel={space.hostDisplayName}
          joinBlocked={joinBlocked}
          onJoin={(sid) => joinSpace(sid)}
          onOpenDebug={openDebug}
        />
        {debugModal}
      </>
    );
  }

  return (
    <>
      <ActiveSpace
        spaceId={spaceId}
        space={space}
        isHost={entryForSpace?.role === 'host'}
        members={members}
        endSpace={endSpace}
        leaveSpace={leaveSpace}
        onOpenDebug={openDebug}
      />
      {debugModal}
    </>
  );
}
