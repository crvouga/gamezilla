/** Production route placement for screen fixtures; component-only stories stay unframed. */
export type StoryRoute = {
  readonly pathname: string;
  readonly tab: boolean;
  /**
   * A screen inside a space, by who mounts its `SpaceScreenFrame`: the story
   * shell (`'shell'`), or the story itself (`'story'`); `false` outside a
   * space. A screen is under exactly one frame, as in the product.
   */
  readonly spaceBody: false | 'shell' | 'story';
  /**
   * What the space's top bar is titled with inside the space, as the
   * product titles it: the game the screen belongs to.
   */
  readonly spaceTitle?: string | undefined;
};

/** The game a family names (`screens-games-<game>-…`), as its menu names it. */
const STORY_GAME_TITLES: readonly (readonly [string, string])[] = [
  ['battleship', 'Battleship'],
  ['chess', 'Chess'],
  ['connect-four', 'Connect Four'],
  ['hearts', 'Hearts'],
  ['light-cycles', 'Light Cycles'],
  ['numberlink', 'Numberlink'],
  ['pong', 'Pong'],
  ['quoridor', 'Quoridor'],
  ['sokoban', 'Sokoban'],
  ['word-tiles', 'Word Tiles'],
];

/**
 * The game each framed screen belongs to, by its story family: a game's
 * own stories its name, puzzles chess, puzzle packs their own name (their
 * fixtures belong to no one game), and the shared frame's stories Connect
 * Four, the game they show.
 */
function storySpaceTitle(family: string): string {
  if (family.startsWith('screens-puzzles')) return 'Chess';
  if (family.startsWith('screens-puzzle-packs')) return 'Puzzle packs';
  const game = STORY_GAME_TITLES.find(([slug]) =>
    family.startsWith(`screens-games-${slug}`)
  );
  return game?.[1] ?? 'Connect Four';
}

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
  // A space's own pages and sheets live under its route, so the Spaces tab
  // stays the active one, as it does in the product.
  'screens-space-join': '/space/story-room',
  'screens-space-ended': '/space/story-room',
  'screens-space-unreachable': '/space/story-room',
  'screens-space-end': '/space/story-room',
  'screens-space-leave': '/space/story-room',
  'screens-spaces-members': '/space/story-room',
  'screens-spaces-remove-person': '/space/story-room',
  'screens-spaces-rename': '/space/story-room',
  'screens-spaces-share': '/space/story-room',
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
// shell frames them the same way. Link screens are outside a space. Every
// `screens-games-<game>-…` family is a game's own screen in a space, so the
// shell frames each one by its prefix, including families added later.
const SPACE_BODY_PREFIX = 'screens-games-';
const SPACE_BODIES = new Set([
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
  'screens-puzzles-import',
  'screens-puzzles-import-source',
  'screens-puzzles-import-status',
  'screens-puzzles-stage',
  'screens-puzzles-result',
  'screens-puzzles-home',
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

// These claim the space's shell to draw their own template. A claim reaches
// only a frame above the screen, and the story shell's frame is not above a
// story it is handed, so each mounts its own frame in its `render`; a second
// frame from the story shell would draw a second top bar over it.
const SELF_FRAMED_SPACE_BODIES = new Set(['screens-space-home']);

/** Overrides let a fixture describe another production placement explicitly. */
export function storyRoute(id: string, override?: StoryRoute): StoryRoute {
  if (override) return override;
  const family = id.split('--')[0] ?? id;
  const tab = TAB_ROUTES[family];
  if (tab !== undefined) return { pathname: tab, tab: true, spaceBody: false };
  if (SELF_FRAMED_SPACE_BODIES.has(family))
    return { pathname: '/space/story-room', tab: false, spaceBody: 'story' };
  if (SPACE_BODIES.has(family) || family.startsWith(SPACE_BODY_PREFIX))
    return {
      pathname: '/space/story-room',
      tab: false,
      spaceBody: 'shell',
      spaceTitle: storySpaceTitle(family),
    };
  // Isolated overlays and templates have no current product destination.
  return {
    pathname: STACK_ROUTES[family] ?? '/not-found',
    tab: false,
    spaceBody: false,
  };
}
