/** Production route placement for screen fixtures; component-only stories stay unframed. */
export type StoryRoute = {
  readonly pathname: string;
  readonly tab: boolean;
  readonly spaceBody: boolean;
};

const TAB_ROUTES: Readonly<Record<string, string>> = {
  'screens-spaces-home': '/',
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
  'screens-matchmaking-link': '/chess/multiplayer',
  'screens-puzzles-link': '/chess/puzzle/story-puzzle',
  'screens-puzzles-import-routed': '/more/puzzles',
  'screens-admin-user-observatory': '/admin/observatory',
  'screens-admin-online-now': '/admin/observatory/online',
  'screens-admin-synthetic-population': '/admin/observatory/synthetic-users',
  'screens-admin-synthetic-users':
    '/admin/observatory/synthetic-users/directory',
  'screens-admin-synthetic-population-workers':
    '/admin/observatory/synthetic-users/workers',
  'screens-admin-synthetic-population-events':
    '/admin/observatory/synthetic-users/events',
  'screens-admin-synthetic-population-config':
    '/admin/observatory/synthetic-users/settings',
  'screens-admin-synthetic-user':
    '/admin/observatory/synthetic-users/story-person',
  'screens-admin-synthetic-user-events':
    '/admin/observatory/synthetic-users/story-person/events',
  'screens-admin-synthetic-user-replay':
    '/admin/observatory/synthetic-users/story-person/replay',
  'screens-admin-synthetic-user-inspector':
    '/admin/observatory/synthetic-users/story-person/inspector',
};

// These views are mounted under SpaceScreenFrame in the product; the story
// shell frames them the same way. Link screens are outside a space.
const SPACE_BODIES = new Set([
  'screens-space-home',
  'screens-games-battleship-board',
  'screens-games-battleship-setup',
  'screens-games-chess-board',
  'screens-games-connect-four-board',
  'screens-matchmaking-stage-menu',
  'screens-matchmaking-home',
  'screens-matchmaking-guide',
  'screens-matchmaking-stage-moves',
  'screens-matchmaking-stage',
  'screens-matchmaking-private-setup',
  'screens-matchmaking-ratings',
  'screens-matchmaking-result',
  'screens-matchmaking-searching',
  'screens-matchmaking-status',
  'screens-matchmaking-time-control',
  'screens-game-home',
  'screens-game-home-how-to-play',
  'screens-game-home-settings',
  'screens-custom-games-home',
  'screens-custom-games-setup',
  'screens-custom-games-setup-seat',
  'screens-custom-games-setup-invite',
  'screens-custom-games-setup-options',
  'screens-custom-games-setup-clock',
  'screens-custom-games-private-setup',
  'screens-custom-games-stage',
  'screens-custom-games-stage-menu',
  'screens-custom-games-stage-moves',
  'screens-custom-games-result',
  'screens-history-games',
  'screens-history-replay',
  'screens-games-hearts-board',
  'screens-games-light-cycles-stage',
  'screens-games-light-cycles-stage-variants',
  'screens-games-numberlink-editor',
  'screens-games-numberlink-puzzle',
  'screens-games-numberlink-preview',
  'screens-games-pong-stage',
  'screens-games-quoridor-hill',
  'screens-games-quoridor-classic',
  'screens-games-sokoban-editor',
  'screens-games-sokoban-puzzle',
  'screens-games-sokoban-preview',
  'screens-games-word-tiles-board',
  'screens-games-word-tiles-editor',
  'screens-games-word-tiles-puzzle',
  'screens-games-word-tiles-puzzle-preview',
  'screens-puzzles-import',
  'screens-puzzles-import-source',
  'screens-puzzles-import-status',
  'screens-games-chess-puzzle',
  'screens-puzzles-stage',
  'screens-puzzle-packs-stage',
  'screens-puzzle-packs-stage-progress',
  'screens-puzzle-packs-builder',
  'screens-puzzle-packs-builder-board',
  'screens-puzzle-packs-builder-copies',
  'screens-puzzle-packs-builder-details',
  'screens-puzzle-packs-builder-preview',
  'screens-puzzle-packs-builder-publish',
  'screens-puzzle-packs-edition',
  'screens-puzzle-packs-home',
  'screens-puzzle-packs-home-browse',
  'screens-puzzle-packs-home-continue',
  'screens-puzzle-packs-home-mine',
  'screens-puzzle-packs-home-playtests',
  'screens-puzzle-packs-home-solved',
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
  if (spaceBody)
    return { pathname: '/space/story-room', tab: false, spaceBody };
  // Isolated overlays and templates have no current product destination.
  return {
    pathname: STACK_ROUTES[family] ?? '/not-found',
    tab: false,
    spaceBody: false,
  };
}
