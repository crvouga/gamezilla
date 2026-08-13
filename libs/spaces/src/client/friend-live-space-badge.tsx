import { Box, Pressable, useRouter } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceLiveBadge } from './space-live-badge';
import { openSpaceDetail } from './space-routes';
import { useFriendLiveSpaceId } from './use-friend-live-space-id';

export type FriendLiveSpaceBadgeProps = {
  readonly hostAccountId: string;
};

/** Shows a live badge when this friend hosts a discoverable live space. */
export function FriendLiveSpaceBadge({
  hostAccountId,
}: FriendLiveSpaceBadgeProps): ReactNode {
  const spaceId = useFriendLiveSpaceId(hostAccountId);
  const router = useRouter();
  if (spaceId === null) return null;
  return (
    <Pressable onPress={() => openSpaceDetail(router, spaceId)}>
      <Box sx={{ px: 1 }}>
        <SpaceLiveBadge spaceId={spaceId} />
      </Box>
    </Pressable>
  );
}
