import { Box } from '@pkgs/ui';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import {
  getSpaceMiniplayerBottomInset,
  isTabRootRoute,
} from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

export type SpaceMiniplayerSlot = 'root' | 'tabBar';

export type SpaceMiniplayerProps = {
  slot: SpaceMiniplayerSlot;
};

const MINIPLAYER_Z_INDEX = 10;

function SpaceMiniplayerCards({ spaceIds }: { spaceIds: string[] }): ReactNode {
  return (
    <Box sx={{ gap: 2 }}>
      {spaceIds.map((spaceId) => (
        <SpaceMiniplayerCard key={spaceId} spaceId={spaceId} />
      ))}
    </Box>
  );
}

function MiniplayerDockContent({ children }: { children: ReactNode }): ReactNode {
  return <Box style={{ width: '100%' }}>{children}</Box>;
}

function TabBarMiniplayerDock({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <Box sx={{ pt: 1, px: 1 }}>
      <MiniplayerDockContent>{children}</MiniplayerDockContent>
    </Box>
  );
}

function RootMiniplayerDock({ children }: { children: ReactNode }): ReactNode {
  const insets = useSafeAreaInsets();

  return (
    <Box
      sx={{ pt: 1, px: 1, background: 'surface' }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: getSpaceMiniplayerBottomInset(insets.bottom),
        zIndex: MINIPLAYER_Z_INDEX,
      }}
    >
      <MiniplayerDockContent>{children}</MiniplayerDockContent>
    </Box>
  );
}

function shouldRenderInSlot(
  slot: SpaceMiniplayerSlot,
  onTabRoute: boolean
): boolean {
  if (slot === 'tabBar') {
    return onTabRoute;
  }
  return !onTabRoute;
}

export function SpaceMiniplayer({ slot }: SpaceMiniplayerProps): ReactNode {
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const pathname = usePathname();
  const rawPath = pathname.split('?')[0] ?? '';
  const onTabRoute = isTabRootRoute(rawPath);

  if (
    spaceIds.length === 0 ||
    !shouldRenderInSlot(slot, onTabRoute)
  ) {
    return null;
  }

  const cards = <SpaceMiniplayerCards spaceIds={spaceIds} />;

  if (slot === 'tabBar') {
    return <TabBarMiniplayerDock>{cards}</TabBarMiniplayerDock>;
  }

  return <RootMiniplayerDock>{cards}</RootMiniplayerDock>;
}
