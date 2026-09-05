/** True when the miniplayer has nothing to show (no live open spaces). */
export function isSpaceMiniplayerHidden(args: {
  activeSpaceCount: number;
}): boolean {
  return args.activeSpaceCount === 0;
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

/** Wide layouts center the miniplayer in a card no wider than this. */
export const MINIPLAYER_WIDE_MAX_WIDTH = 640;

export type MiniplayerLayoutMode = 'compact' | 'wide';

export type MiniplayerFrame = {
  /** Card corners (wide) vs full-bleed strip above the tab bar (compact). */
  readonly rounded: boolean;
  /** Centered max width on wide; `null` spans the container. */
  readonly maxWidth: number | null;
};

/** Frame the miniplayer takes for a layout mode; pinned to the bottom in both. */
export function resolveMiniplayerFrame(
  mode: MiniplayerLayoutMode
): MiniplayerFrame {
  if (mode === 'wide') {
    return { rounded: true, maxWidth: MINIPLAYER_WIDE_MAX_WIDTH };
  }
  return { rounded: false, maxWidth: null };
}
