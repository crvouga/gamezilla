/** Scroll Y at/above which the TopBar title becomes visible. */
export const SCREEN_TITLE_REVEAL_OFFSET = 40;

/** Pure helper: whether the compact TopBar title should show. */
export function shouldShowTopBarTitle(scrollY: number): boolean {
  return scrollY >= SCREEN_TITLE_REVEAL_OFFSET;
}
