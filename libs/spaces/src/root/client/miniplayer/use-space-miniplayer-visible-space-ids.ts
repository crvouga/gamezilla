import { type Accessor, createMemo } from 'solid-js';
import { useCurrentSpaceIds } from '../use-current-space-ids';

/**
 * Space ids the miniplayer should currently render.
 *
 * Do not hide on `/space/:id`: that route is a fullScreenModal over the tabs,
 * so the tab bar (and miniplayer) are already covered. Unmounting on that
 * route forced a remount after dismiss and left the bar empty in product-harness.
 */
export function useSpaceMiniplayerVisibleSpaceIds(): Accessor<string[]> {
  const current = useCurrentSpaceIds();
  return createMemo(() => {
    if (current.isLoading() || current.entries().length === 0) {
      return [];
    }
    return current.entries().map((e) => e.spaceId);
  });
}
