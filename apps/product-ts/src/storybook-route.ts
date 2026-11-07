/** Production route placement for screen fixtures; component-only stories stay unframed. */
export type StoryRoute = {
  readonly pathname: string;
  readonly tab: boolean;
  readonly spaceBody: boolean;
};

const TAB_ROUTES: Readonly<Record<string, string>> = {
  'screens-spaces-lobby': '/',
  'screens-search-people': '/search',
  'screens-notifications-inbox': '/notifications',
  'screens-profile-tab': '/profile',
};

// Concrete paths from the product route table and each sub's route declarations.
const STACK_ROUTES: Readonly<Record<string, string>> = {
  'screens-settings-index': '/more',
  'screens-settings-appearance': '/more/theme',
  'screens-settings-performance': '/more/performance',
  'screens-settings-sound': '/more/sound',
  'screens-settings-about': '/more/about',
  'screens-settings-sync': '/more/sync',
  'screens-settings-troubleshooting': '/more/troubleshooting',
  'screens-settings-connection': '/more/server-status',
  'screens-settings-client-config': '/more/client-config',
  'screens-account': '/more/account',
  'screens-account-devices': '/more/account/devices',
  'screens-account-device-detail': '/more/account/device/story-device',
  'screens-privacy': '/profile/privacy',
  'screens-billing': '/more/billing',
  'screens-profile-edit': '/profile/edit',
  'screens-profile-handle': '/profile/handle',
  'screens-profile-avatar': '/profile/avatar',
  'screens-friends-list': '/profile/friends',
  'screens-friends-user': '/profile/user/story-person',
  'screens-notifications-friends': '/notifications',
  'screens-inspector-client-events': '/client/events',
  'screens-inspector-client-sql': '/client/sql',
  'screens-shell-sso-callback': '/sso-callback',
  'screens-games-matchmaking-link': '/chess/multiplayer',
  'screens-puzzles-link': '/chess/puzzle/story-puzzle',
  'screens-admin-synthetic-population': '/admin/synthetic-population',
  'screens-admin-synthetic-population-config':
    '/admin/synthetic-population/config',
  'screens-admin-synthetic-user':
    '/admin/synthetic-population/users/story-person',
};

// These views are mounted under SpaceActiveLayout in the product. Link screens
// and the complete SpaceDetailScreenView are deliberately not wrapped again.
const SPACE_BODIES = new Set([
  'screens-spaces-games',
  'screens-games-battleship-board',
  'screens-games-battleship-setup',
  'screens-games-chess-board',
  'screens-games-chess-developer',
  'screens-games-chess-settings',
  'screens-games-connect-four-board',
  'screens-games-matchmaking',
  'screens-games-menu',
  'screens-games-custom-setup',
  'screens-games-frame',
  'screens-games-frame-history',
  'screens-games-frame-replay',
  'screens-games-hearts-board',
  'screens-games-light-cycles-arena',
  'screens-games-light-cycles-variants',
  'screens-games-numberlink-editor',
  'screens-games-numberlink-puzzle',
  'screens-games-numberlink-preview',
  'screens-games-pong-court',
  'screens-games-quoridor-hill',
  'screens-games-quoridor-classic',
  'screens-games-sokoban-editor',
  'screens-games-sokoban-puzzle',
  'screens-games-sokoban-preview',
  'screens-games-word-tiles-board',
  'screens-games-word-tiles-editor',
  'screens-games-word-tiles-puzzle',
  'screens-games-word-tiles-puzzle-preview',
  'screens-puzzles-management',
  'screens-puzzles-chess-play',
  'screens-puzzles-play',
  'screens-puzzles-content-attempt',
  'screens-puzzles-content-author',
  'screens-puzzles-content-edition',
  'screens-puzzles-content-library',
  'screens-puzzles-personal-stats',
  'screens-puzzles-review',
  'screens-puzzles-stats',
]);

/** Overrides let a fixture describe another production placement explicitly. */
export function storyRoute(id: string, override?: StoryRoute): StoryRoute {
  if (override) return override;
  const family = id.split('--')[0] ?? id;
  const tab = TAB_ROUTES[family];
  if (tab !== undefined) return { pathname: tab, tab: true, spaceBody: false };
  const spaceBody = SPACE_BODIES.has(family);
  if (spaceBody || family === 'screens-spaces-detail')
    return { pathname: '/space/story-room', tab: false, spaceBody };
  // Isolated overlays and templates have no current product destination.
  return {
    pathname: STACK_ROUTES[family] ?? '/not-found',
    tab: false,
    spaceBody: false,
  };
}
