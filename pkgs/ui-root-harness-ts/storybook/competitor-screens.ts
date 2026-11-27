/**
 * Declarative pairing of a competitor screenshot with the Storybook story
 * that shows our equivalent screen.
 *
 * Add a screenshot under `docs/competitor-ui-catalog/` (kebab-case `.png`),
 * then add one entry here. `story` is the CSF id (`<meta.id>--<export>`),
 * the same id Storybook uses in `?path=/story/<id>`.
 */

export type CompetitorScreen = {
  /** File name inside `docs/competitor-ui-catalog/`. */
  readonly screenshot: string;
  /** What the competitor screen is, for the comparison caption. */
  readonly label: string;
  /** CSF story id of our screen. */
  readonly story: string;
  /** Sidebar title of that story, so a review can find it without the id. */
  readonly storyTitle: string;
};

export const COMPETITOR_CATALOG = 'docs/competitor-ui-catalog';

/** Phone viewport the screen stories are reviewed at. */
export const COMPARISON_VIEWPORT = { width: 390, height: 844 } as const;

export const competitorScreens: readonly CompetitorScreen[] = [
  {
    screenshot: 'chess-com-main-menu-1.png',
    label: 'Chess.com play menu',
    story: 'screens-game-home--with-puzzles-and-settings',
    storyTitle: 'Screens/Space/Game home/Home · With puzzles and settings',
  },
  {
    screenshot: 'chess-com-main-menu-2.png',
    label: 'Chess.com play menu, more open',
    story: 'screens-game-home--open-more',
    storyTitle: 'Screens/Space/Game home/Home · Open more',
  },
  {
    screenshot: 'chess-com-choose-time.png',
    label: 'Chess.com choose time',
    story: 'screens-matchmaking-time-control--choices',
    storyTitle: 'Screens/Space/Matchmaking/Time control · Choices',
  },
  {
    screenshot: 'chess-com-matchmaking-searching.png',
    label: 'Chess.com searching for an opponent',
    story: 'screens-matchmaking-searching--searching',
    storyTitle: 'Screens/Space/Matchmaking/Searching · Searching',
  },
  {
    screenshot: 'chess-com-matchmaking-playing.png',
    label: 'Chess.com matched game in play',
    story: 'screens-matchmaking-stage--matched',
    storyTitle: 'Screens/Space/Matchmaking/Stage · Matched',
  },
  {
    screenshot: 'chess-com-matchmaking-endgame-board.png',
    label: 'Chess.com finished board',
    story: 'screens-games-chess-board--checkmated',
    storyTitle: 'Screens/Space/Boards/Chess/Board · Checkmated',
  },
  {
    screenshot: 'chess-com-matchmaking-endgame-modal.png',
    label: 'Chess.com game-over result',
    story: 'screens-matchmaking-result--after-the-game',
    storyTitle: 'Screens/Space/Matchmaking/Result · After the game',
  },
  {
    screenshot: 'chess-com-puzzle-1.png',
    label: 'Chess.com puzzle in play',
    story: 'screens-puzzles-stage--solving',
    storyTitle: 'Screens/Space/Puzzles/Stage · Solving',
  },
  {
    screenshot: 'flow-free-choose-pack.png',
    label: 'Flow Free pack list',
    story: 'screens-puzzle-packs-home--populated',
    storyTitle: 'Screens/Space/Puzzle packs/Home · Populated',
  },
  {
    screenshot: 'flow-free-choose-puzzle.png',
    label: 'Flow Free puzzle grid in a pack',
    story: 'screens-games-numberlink-catalog--first-threads',
    storyTitle: 'Screens/Space/Boards/Numberlink/Catalog · First threads',
  },
  {
    screenshot: 'flow-free-play-puzzle.png',
    label: 'Flow Free puzzle in play',
    story: 'screens-games-numberlink-puzzle--fresh',
    storyTitle: 'Screens/Space/Boards/Numberlink/Puzzle · Fresh',
  },
  {
    screenshot: 'words-with-friends-in-progress-games.png',
    label: 'Words With Friends games in progress',
    story: 'screens-history-games--populated',
    storyTitle: 'Screens/Space/History/Games · Populated',
  },
  {
    screenshot: 'words-with-friends-play.png',
    label: 'Words With Friends board in play',
    story: 'screens-games-word-tiles-board--your-turn',
    storyTitle: 'Screens/Space/Boards/Word Tiles/Board · Your turn',
  },
];
