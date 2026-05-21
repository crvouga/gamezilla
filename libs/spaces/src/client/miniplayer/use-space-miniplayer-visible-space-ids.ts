import { isSpaceMiniplayerHidden } from './space-miniplayer-layout';
import { useCurrentSpaceIds } from '../use-current-space-ids';
import { usePathname } from 'expo-router';

/**
 * Space ids the miniplayer should currently render. Returns an empty list
 * either when the user has no active spaces, or when the current route
 * already shows the space (full screen).
 */
export function useSpaceMiniplayerVisibleSpaceIds(): string[] {
  const pathname = usePathname();
  const { entries, isLoading } = useCurrentSpaceIds();
  const rawPath = pathname.split('?')[0] ?? '';
  if (
    isLoading ||
    isSpaceMiniplayerHidden({
      rawPath,
      activeSpaceCount: entries.length,
    })
  ) {
    return [];
  }
  return entries.map((e) => e.spaceId);
}
