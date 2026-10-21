export const MULTIPLAYER_LINK_ROUTE = '/:gameId/multiplayer';
/** Stable per-game route for turn and result notices. */
export function multiplayerLinkRoute(gameId: string): string {
  return `/${encodeURIComponent(gameId)}/multiplayer`;
}
export const LINKED_MULTIPLAYER_PARAM = 'multiplayer';
