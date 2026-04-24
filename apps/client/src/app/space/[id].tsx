import { useSpaceActions } from '@gamezilla/client/features/spaces/space-actions';
import { SpaceMemberList } from '@gamezilla/client/features/spaces/space-member-list';
import {
  useCurrentMembership,
  usePrincipalDisplayName,
  useSpace,
  useSpaceMembers,
} from '@gamezilla/client/features/spaces/use-spaces';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { SpaceMembershipAttr } from '@gamezilla/domain/spaces/space-entities';
import {
  Box,
  Button,
  ConfirmationModal,
  ScreenBase,
  Text,
} from '@gamezilla/lib/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function SpaceDetailScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = typeof id === 'string' ? id : undefined;

  const space = useSpace(spaceId);
  const current = useCurrentMembership();
  const { members } = useSpaceMembers(spaceId);
  const { joinSpace, leaveSpace, endSpace } = useSpaceActions();
  const hostLabel = usePrincipalDisplayName(space.hostId);

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const pageLoading = space.loading || current.loading;

  const membershipSpaceId = (() => {
    const raw = current.membershipEntity?.attributes[SpaceMembershipAttr.spaceId];
    return typeof raw === 'string' ? raw : null;
  })();
  const membershipLeftAt =
    current.membershipEntity?.attributes[SpaceMembershipAttr.leftAt];

  useEffect(() => {
    if (!spaceId || !space.space || space.live) return;
    const left = membershipLeftAt !== undefined && membershipLeftAt !== null;
    if (
      membershipSpaceId === spaceId &&
      !left
    ) {
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

  const inThisSpace = current.activeSpaceId === spaceId;

  if (pageLoading) {
    return (
      <ScreenBase
        breadcrumbs={[{ name: 'Spaces', onPress: nav('/') }, { name: 'Space' }]}
        content={({ sx }) => (
          <Box style={sx} sx={{ flex: 1, justifyContent: 'center' }}>
            <Text variant="body" sx={{ color: 'textSecondary' }} label="Loading…" />
          </Box>
        )}
      />
    );
  }

  if (!space.space) {
    return (
      <ScreenBase
        breadcrumbs={[{ name: 'Spaces', onPress: nav('/') }, { name: 'Space' }]}
        content={({ sx }) => (
          <Box style={sx} sx={{ flex: 1, justifyContent: 'center' }}>
            <Text
              variant="body"
              sx={{ color: 'textSecondary' }}
              label="This space could not be found."
            />
            <Box sx={{ mt: 3 }}>
              <Button
                title="Go back"
                variant="solid"
                onPress={() => router.back()}
              />
            </Box>
          </Box>
        )}
      />
    );
  }

  if (!space.live) {
    return (
      <ScreenBase
        breadcrumbs={[
          { name: 'Spaces', onPress: nav('/') },
          { name: space.title },
        ]}
        content={({ sx }) => (
          <Box style={sx} sx={{ flex: 1, justifyContent: 'center', gap: 3 }}>
            <Text
              variant="body"
              sx={{ color: 'textSecondary', textAlign: 'center' }}
              label="This space has ended."
            />
            <Button
              title="Go back"
              variant="solid"
              onPress={() => router.back()}
            />
          </Box>
        )}
      />
    );
  }

  if (!inThisSpace) {
    return (
      <ScreenBase
        breadcrumbs={[
          { name: 'Spaces', onPress: nav('/') },
          { name: space.title },
        ]}
        content={({ sx }) => (
          <Box style={sx} sx={{ gap: 3 }}>
            <Text variant="label" sx={{ color: 'textSecondary' }} label="Host" />
            <Text variant="bodyBold" label={hostLabel} />
            <Text
              variant="body"
              sx={{ color: 'textSecondary' }}
              label="Join this space to see who is here and hang out."
            />
            <Button
              title="Join space"
              variant="solid"
              onPress={() => {
                if (spaceId) void joinSpace(spaceId);
              }}
            />
            <Button title="Back" variant="outlined" onPress={() => router.back()} />
          </Box>
        )}
      />
    );
  }

  const isHost = current.role === 'host';

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: space.title },
      ]}
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 4 }}>
          <SpaceMemberList members={members} />

          {isHost ? (
            <Button
              title="End space"
              variant="solid"
              onPress={() => setConfirmEnd(true)}
            />
          ) : (
            <Button
              title="Leave space"
              variant="outlined"
              onPress={() => setConfirmLeave(true)}
            />
          )}

          <ConfirmationModal
            visible={confirmEnd}
            title="End space?"
            message="Everyone will leave this space. This cannot be undone."
            confirmLabel="End space"
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={() => {
              setConfirmEnd(false);
              void (async () => {
                if (spaceId) await endSpace(spaceId);
                router.back();
              })();
            }}
            onCancel={() => setConfirmEnd(false)}
          />
          <ConfirmationModal
            visible={confirmLeave}
            title="Leave space?"
            message="You can join again later if the space is still live."
            confirmLabel="Leave"
            cancelLabel="Cancel"
            variant="default"
            onConfirm={() => {
              setConfirmLeave(false);
              void leaveSpace();
              router.back();
            }}
            onCancel={() => setConfirmLeave(false)}
          />
        </Box>
      )}
    />
  );
}
