import { useSpaceDisplayTitle } from './use-space-display-title';

/** Plain-string label for a space (command palette titles). */
export function useSpaceCommandLabel(spaceId: string): string {
  return useSpaceDisplayTitle(spaceId);
}
