import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

function MiniplayerDock({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Box
      sx={{ pt: 2, px: 1 }}
      style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }}
    >
      {children}
    </Box>
  );
}

export function SpaceMiniplayer(): ReactNode {
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  if (spaceIds.length === 0) return null;
  return (
    <MiniplayerDock>
      <Box sx={{ gap: 2 }}>
        {spaceIds.map((spaceId) => (
          <SpaceMiniplayerCard key={spaceId} spaceId={spaceId} />
        ))}
      </Box>
    </MiniplayerDock>
  );
}
