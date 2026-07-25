import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSpaceVisibleProfilesSubscription } from '../use-space-visible-profiles-subscription';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

function SpaceMiniplayerCards({ spaceIds }: { spaceIds: string[] }): ReactNode {
  return (
    <Box sx={{ flexDirection: 'column' }}>
      {spaceIds.map((spaceId) => (
        <SpaceMiniplayerCard key={spaceId} spaceId={spaceId} />
      ))}
    </Box>
  );
}

export function SpaceMiniplayer(): ReactNode {
  const paintReady = useSyncEnginePaintReady();
  useSpaceVisibleProfilesSubscription();
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  if (!paintReady || spaceIds.length === 0) return null;
  return <SpaceMiniplayerCards spaceIds={spaceIds} />;
}
