import { Box, useBreakpoint } from '@pkgs/ui';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import {
  getSpaceMiniplayerDesktopTopOffset,
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

function TabBarMiniplayerDock({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <Box sx={{ pt: 1, px: 1 }}>{children}</Box>;
}

function RootMiniplayerDock({ children }: { children: ReactNode }): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';
  const insets = useSafeAreaInsets();

  if (!isMobile) {
    return (
      <Box
        sx={{ pt: 1, px: 1, background: 'surface' }}
        style={{
          position: 'absolute',
          top: getSpaceMiniplayerDesktopTopOffset(insets.top),
          left: 0,
          right: 0,
          zIndex: MINIPLAYER_Z_INDEX,
        }}
      >
        {children}
      </Box>
    );
  }

  const bottomInset = insets.bottom > 0 ? insets.bottom : 12;
  return (
    <Box
      sx={{ pt: 1, px: 1 }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomInset,
        zIndex: MINIPLAYER_Z_INDEX,
      }}
    >
      {children}
    </Box>
  );
}

function shouldRenderInSlot(
  slot: SpaceMiniplayerSlot,
  isMobile: boolean,
  onTabRoute: boolean
): boolean {
  if (slot === 'tabBar') {
    return isMobile && onTabRoute;
  }
  if (isMobile && onTabRoute) {
    return false;
  }
  return true;
}

export function SpaceMiniplayer({ slot }: SpaceMiniplayerProps): ReactNode {
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const isMobile = useBreakpoint() === 'mobile';
  const pathname = usePathname();
  const rawPath = pathname.split('?')[0] ?? '';
  const onTabRoute = isTabRootRoute(rawPath);

  if (
    spaceIds.length === 0 ||
    !shouldRenderInSlot(slot, isMobile, onTabRoute)
  ) {
    return null;
  }

  const cards = <SpaceMiniplayerCards spaceIds={spaceIds} />;

  if (slot === 'tabBar') {
    return <TabBarMiniplayerDock>{cards}</TabBarMiniplayerDock>;
  }

  return <RootMiniplayerDock>{cards}</RootMiniplayerDock>;
}
