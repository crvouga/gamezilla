import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  SpaceActionAuthError,
  useSpaceActions,
} from '@gamezilla/client/spaces/space-actions';
import { SpaceCounterPanel } from '@gamezilla/client/spaces/space-counter-panel';
import { SpaceRoomWireContext } from '@gamezilla/client/spaces/space-room-wire-context';
import { useSpaceRoom } from '@gamezilla/client/spaces/use-space-room';
import { SpaceDebugModal } from '@gamezilla/client/spaces/space-debug-modal';
import { SpaceMemberList } from '@gamezilla/client/spaces/space-member-list';
import {
  useCurrentMembership,
  useSpace,
  useSpaceMembers,
} from '@gamezilla/client/spaces/use-spaces';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { SpaceMembershipAttr } from '@gamezilla/domain/spaces/space-entities';
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

type Space = ReturnType<typeof useSpace>;
type CurrentMembership = ReturnType<typeof useCurrentMembership>;

function useAutoLeaveIfEnded(args: {
  spaceId: string | undefined;
  space: Space;
  current: CurrentMembership;
  leaveSpace: () => Promise<void> | void;
}) {
  const { spaceId, space, current, leaveSpace } = args;
  const membershipSpaceId = (() => {
    const raw =
      current.membershipEntity?.attributes[SpaceMembershipAttr.spaceId];
    return typeof raw === 'string' ? raw : null;
  })();
  const membershipLeftAt =
    current.membershipEntity?.attributes[SpaceMembershipAttr.leftAt];

  useEffect(() => {
    if (!spaceId || !space.space || space.live) return;
    const left = membershipLeftAt !== undefined && membershipLeftAt !== null;
    if (membershipSpaceId === spaceId && !left) {
      void leaveSpace();
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
  needsSignIn,
  onJoin,
  onOpenDebug,
}: {
  spaceId: string | undefined;
  title: string;
  hostLabel: string;
  needsSignIn: boolean;
  onJoin: (id: string) => Promise<void> | void;
  onOpenDebug: () => void;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const auth = useAuth();
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
          {needsSignIn ? (
            <Button
              title={t`Sign in`}
              variant="solid"
              onPress={() => {
                auth.openSignInModal();
              }}
            />
          ) : (
            <Button
              title={t`Join space`}
              variant="solid"
              onPress={() => {
                if (spaceId) void onJoin(spaceId);
              }}
            />
          )}
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
  current,
  members,
  endSpace,
  leaveSpace,
  onOpenDebug,
}: {
  spaceId: string | undefined;
  space: Space;
  current: CurrentMembership;
  members: ReturnType<typeof useSpaceMembers>['members'];
  endSpace: (id: string) => Promise<void> | void;
  leaveSpace: () => Promise<void> | void;
  onOpenDebug: () => void;
}) {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isHost = current.role === 'host';
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
    void leaveSpace();
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
  const current = useCurrentMembership();
  const { members } = useSpaceMembers(spaceId);
  const { joinSpace, leaveSpace, endSpace } = useSpaceActions();
  const auth = useAuth();
  const [debugOpen, setDebugOpen] = useState(false);
  const openDebug = () => setDebugOpen(true);
  const closeDebug = () => setDebugOpen(false);

  useAutoLeaveIfEnded({ spaceId, space, current, leaveSpace });

  const debugModal = (
    <SpaceDebugModal
      visible={debugOpen}
      onClose={closeDebug}
      spaceId={spaceId}
      space={space}
      current={current}
      members={members}
    />
  );

  if (space.isLoading || current.isLoading) {
    return <SpaceLoading />;
  }

  const inThisSpace = current.activeSpaceId === spaceId;
  if (!inThisSpace) {
    const needsSignIn = auth.mode !== 'signed-in';
    return (
      <>
        <JoinPrompt
          spaceId={spaceId}
          title={space.title}
          hostLabel={space.hostDisplayName}
          needsSignIn={needsSignIn}
          onJoin={async (sid) => {
            try {
              await joinSpace(sid);
            } catch (e) {
              if (e instanceof SpaceActionAuthError) {
                auth.openSignInModal();
              } else {
                throw e;
              }
            }
          }}
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
        current={current}
        members={members}
        endSpace={endSpace}
        leaveSpace={leaveSpace}
        onOpenDebug={openDebug}
      />
      {debugModal}
    </>
  );
}
