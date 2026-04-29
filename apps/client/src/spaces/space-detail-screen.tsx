import { useSpaceActions } from '@gamezilla/client/spaces/space-actions';
import { SpaceMemberList } from '@gamezilla/client/spaces/space-member-list';
import {
  useCurrentMembership,
  usePrincipalDisplayName,
  useSpace,
  useSpaceMembers,
} from '@gamezilla/client/spaces/use-spaces';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { SpaceMembershipAttr } from '@gamezilla/domain/spaces/space-entities';
import {
  Box,
  Button,
  ConfirmationModal,
  ScreenBase,
  Text,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@gamezilla/lib/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

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

function LoadingState() {
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Space</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx} sx={{ flex: 1, justifyContent: 'center' }}>
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={<Trans>Loading…</Trans>}
          />
        </Box>
      )}
    />
  );
}

function NotFoundState() {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Space</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx} sx={{ flex: 1, justifyContent: 'center' }}>
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={<Trans>This space could not be found.</Trans>}
          />
          <Box sx={{ mt: 3 }}>
            <Button
              title={t`Go back`}
              variant="solid"
              onPress={() => router.back()}
            />
          </Box>
        </Box>
      )}
    />
  );
}

function EndedState({ title }: { title: string }) {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: title },
      ]}
      content={({ sx }) => (
        <Box style={sx} sx={{ flex: 1, justifyContent: 'center', gap: 3 }}>
          <Text
            variant="body"
            sx={{ color: 'textSecondary', textAlign: 'center' }}
            label={<Trans>This space has ended.</Trans>}
          />
          <Button
            title={t`Go back`}
            variant="solid"
            onPress={() => router.back()}
          />
        </Box>
      )}
    />
  );
}

function JoinPrompt({
  spaceId,
  title,
  hostLabel,
  onJoin,
}: {
  spaceId: string | undefined;
  title: string;
  hostLabel: string;
  onJoin: (id: string) => Promise<void> | void;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: title },
      ]}
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          <Text variant="label" sx={{ color: 'textSecondary' }} label={<Trans>Host</Trans>} />
          <Text variant="bodyBold" label={hostLabel} />
          <Text
            variant="body"
            sx={{ color: 'textSecondary' }}
            label={
              <Trans>Join this space to see who is here and hang out.</Trans>
            }
          />
          <Button
            title={t`Join space`}
            variant="solid"
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

function ActiveSpace({
  spaceId,
  space,
  current,
  members,
  endSpace,
  leaveSpace,
}: {
  spaceId: string | undefined;
  space: Space;
  current: CurrentMembership;
  members: ReturnType<typeof useSpaceMembers>['members'];
  endSpace: (id: string) => Promise<void> | void;
  leaveSpace: () => Promise<void> | void;
}) {
  const { t } = useLingui();
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isHost = current.role === 'host';

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
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 4 }}>
          <SpaceMemberList members={members} />
          {isHost ? (
            <Button
              title={t`End space`}
              variant="solid"
              onPress={() => setConfirmEnd(true)}
            />
          ) : (
            <Button
              title={t`Leave space`}
              variant="outlined"
              onPress={() => setConfirmLeave(true)}
            />
          )}
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

export function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = typeof id === 'string' ? id : undefined;

  const space = useSpace(spaceId);
  const current = useCurrentMembership();
  const { members } = useSpaceMembers(spaceId);
  const { joinSpace, leaveSpace, endSpace } = useSpaceActions();
  const hostLabel = usePrincipalDisplayName(space.hostId);

  useAutoLeaveIfEnded({ spaceId, space, current, leaveSpace });

  const pageLoading = space.loading || current.loading;
  if (pageLoading) return <LoadingState />;
  if (!space.space) return <NotFoundState />;
  if (!space.live) return <EndedState title={space.title} />;

  const inThisSpace = current.activeSpaceId === spaceId;
  if (!inThisSpace) {
    return (
      <JoinPrompt
        spaceId={spaceId}
        title={space.title}
        hostLabel={hostLabel}
        onJoin={joinSpace}
      />
    );
  }

  return (
    <ActiveSpace
      spaceId={spaceId}
      space={space}
      current={current}
      members={members}
      endSpace={endSpace}
      leaveSpace={leaveSpace}
    />
  );
}
