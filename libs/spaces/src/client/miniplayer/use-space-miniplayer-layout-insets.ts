import { useBreakpoint } from '@pkgs/ui';
import { usePathname } from 'expo-router';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  estimateSpaceMiniplayerHeight,
  isTabRootRoute,
} from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

export type SpaceMiniplayerLayoutInsets = {
  top: number;
  bottom: number;
};

export function useSpaceMiniplayerLayoutInsets(): SpaceMiniplayerLayoutInsets {
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const isMobile = useBreakpoint() === 'mobile';
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const rawPath = pathname.split('?')[0] ?? '';
  const onTabRoute = isTabRootRoute(rawPath);

  return useMemo((): SpaceMiniplayerLayoutInsets => {
    if (spaceIds.length === 0) {
      return { top: 0, bottom: 0 };
    }

    const height = estimateSpaceMiniplayerHeight(spaceIds.length);

    if (!isMobile) {
      return { top: height, bottom: 0 };
    }

    if (onTabRoute) {
      return { top: 0, bottom: 0 };
    }

    const bottomInset = insets.bottom > 0 ? insets.bottom : 12;
    return { top: 0, bottom: height + bottomInset };
  }, [spaceIds.length, isMobile, onTabRoute, insets.bottom]);
}
