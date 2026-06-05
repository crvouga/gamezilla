import { TOP_BAR_CONTENT_HEIGHT } from '@pkgs/ui';

export function isSpaceMiniplayerHidden(args: {
  rawPath: string;
  activeSpaceCount: number;
}): boolean {
  return args.rawPath.startsWith('/space/') || args.activeSpaceCount === 0;
}

export function isTabRootRoute(rawPath: string): boolean {
  if (rawPath === '/' || rawPath === '/profile') return true;
  if (rawPath === '/(tabs)' || rawPath.startsWith('/(tabs)/')) return true;
  return false;
}

export function getSpaceMiniplayerDesktopTopOffset(topInset: number): number {
  return topInset + TOP_BAR_CONTENT_HEIGHT;
}

export function getSpaceMiniplayerMobileTabBarOffset(bottomInset: number): number {
  return TOP_BAR_CONTENT_HEIGHT + bottomInset;
}

const DOCK_PADDING_TOP = 4;
const CARD_MIN_HEIGHT = 72;
const CARD_GAP = 8;

export function estimateSpaceMiniplayerHeight(cardCount: number): number {
  if (cardCount <= 0) return 0;
  return (
    DOCK_PADDING_TOP +
    cardCount * CARD_MIN_HEIGHT +
    (cardCount - 1) * CARD_GAP
  );
}
