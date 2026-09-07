import type { Accessor } from 'solid-js';
import { useSpaceDisplayTitle } from './use-space-display-title';

/** Plain-string label for a space (command palette titles). */
export function useSpaceCommandLabel(
  spaceId: string | Accessor<string>
): Accessor<string> {
  return useSpaceDisplayTitle(spaceId);
}
