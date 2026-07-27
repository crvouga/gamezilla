export function isSpaceMiniplayerHidden(args: {
  rawPath: string;
  activeSpaceCount: number;
}): boolean {
  return args.rawPath.startsWith('/space/') || args.activeSpaceCount === 0;
}

export type MiniplayerMode =
  | { readonly mode: 'hidden'; readonly spaceIds: readonly [] }
  | {
      readonly mode: 'single';
      readonly spaceIds: readonly [string];
      readonly primarySpaceId: string;
    }
  | {
      readonly mode: 'stack';
      readonly spaceIds: readonly string[];
      readonly primarySpaceId: string;
    };

/**
 * Resolves how the miniplayer should render for the current live space list.
 * `spaceIds` is expected newest-first.
 */
export function resolveMiniplayerMode(
  spaceIds: readonly string[]
): MiniplayerMode {
  if (spaceIds.length === 0) {
    return { mode: 'hidden', spaceIds: [] };
  }
  const primarySpaceId = spaceIds[0]!;
  if (spaceIds.length === 1) {
    return {
      mode: 'single',
      spaceIds: [primarySpaceId],
      primarySpaceId,
    };
  }
  return {
    mode: 'stack',
    spaceIds,
    primarySpaceId,
  };
}

/** Peek layers behind the front stacked card (not including the front). */
export const MINIPLAYER_STACK_PEEK_COUNT = 2;
