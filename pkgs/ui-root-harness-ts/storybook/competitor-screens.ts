/**
 * Declarative pairing of a competitor screenshot with the Storybook story
 * that shows our equivalent screen.
 *
 * Add a screenshot under `docs/competitor-ui-catalog/` (kebab-case `.png`),
 * then add one entry here. `story` is the CSF id (`<meta.id>--<export>`),
 * the same id Storybook uses in `?path=/story/<id>`.
 *
 * A shot with no equivalent screen stays in the catalog and out of this list.
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
    screenshot: 'chess-com-choose-time-1.png',
    label: 'Chess.com choose time',
    story: 'screens-matchmaking-time-control--choices',
    storyTitle: 'Screens/Space/Matchmaking/Time control · Choices',
  },
  {
    screenshot: 'chess-com-custom-game-setup-1.PNG',
    label: 'Chess.com custom game setup',
    story: 'screens-custom-games-setup--host-with-options',
    storyTitle: 'Screens/Space/Custom games/Setup · Host with options',
  },
  {
    screenshot: 'chess-com-custom-game-play-friend-1.PNG',
    label: 'Chess.com play a friend',
    story: 'screens-custom-games-setup-invite--people',
    storyTitle: 'Screens/Space/Custom games/Setup invite · People',
  },
  {
    screenshot: 'chess-com-custom-game-choose-bot-1.PNG',
    label: 'Chess.com choose a bot',
    story: 'screens-custom-games-setup-seat--choose-bot',
    storyTitle: 'Screens/Space/Custom games/Setup seat · Choose bot',
  },
  {
    screenshot: 'chess-com-custom-game-bot-1.PNG',
    label: 'Chess.com game against a bot',
    story: 'screens-custom-games-stage--against-bot',
    storyTitle: 'Screens/Space/Custom games/Stage · Against bot',
  },
  {
    screenshot: 'chess-com-custom-game-endgame-modal-1.PNG',
    label: 'Chess.com bot game over',
    story: 'screens-custom-games-result--you-win',
    storyTitle: 'Screens/Space/Custom games/Result · You win',
  },
  {
    screenshot: 'chess-com-matchmaking-searching-1.png',
    label: 'Chess.com searching for an opponent',
    story: 'screens-matchmaking-searching--searching',
    storyTitle: 'Screens/Space/Matchmaking/Searching · Searching',
  },
  {
    screenshot: 'chess-com-matchmaking-vs-1.PNG',
    label: 'Chess.com opponent found',
    story: 'screens-matchmaking-stage--no-moves-yet',
    storyTitle: 'Screens/Space/Matchmaking/Stage · No moves yet',
  },
  {
    screenshot: 'chess-com-matchmaking-playing-1.png',
    label: 'Chess.com matched game in play',
    story: 'screens-matchmaking-stage--matched',
    storyTitle: 'Screens/Space/Matchmaking/Stage · Matched',
  },
  {
    screenshot: 'chess-com-matchmaking-endgame-board-1.png',
    label: 'Chess.com finished board',
    story: 'screens-games-chess-board--checkmated',
    storyTitle: 'Screens/Space/Boards/Chess/Board · Checkmated',
  },
  {
    screenshot: 'chess-com-matchmaking-endgame-modal-1.png',
    label: 'Chess.com game-over result',
    story: 'screens-matchmaking-result--after-the-game',
    storyTitle: 'Screens/Space/Matchmaking/Result · After the game',
  },
  {
    screenshot: 'chess-com-play-coach-2.PNG',
    label: 'Chess.com coach beside the board',
    story: 'screens-puzzles-stage--long-coach-line',
    storyTitle: 'Screens/Space/Puzzles/Stage · Long coach line',
  },
  {
    screenshot: 'chess-com-puzzle-1.png',
    label: 'Chess.com puzzle in play',
    story: 'screens-puzzles-stage--solving',
    storyTitle: 'Screens/Space/Puzzles/Stage · Solving',
  },
  {
    screenshot: 'chess-com-puzzle-2.PNG',
    label: 'Chess.com puzzle hint',
    story: 'screens-puzzles-stage--ask-for-hint',
    storyTitle: 'Screens/Space/Puzzles/Stage · Ask for hint',
  },
  {
    screenshot: 'chess-com-puzzle-hint-1.PNG',
    label: 'Chess.com puzzle hint on the board',
    story: 'screens-puzzles-stage--hint',
    storyTitle: 'Screens/Space/Puzzles/Stage · Hint',
  },
  {
    screenshot: 'chess-com-puzzle-hint-2.PNG',
    label: 'Chess.com puzzle solved',
    story: 'screens-puzzles-stage--correct-move',
    storyTitle: 'Screens/Space/Puzzles/Stage · Correct move',
  },
  {
    screenshot: 'chess-com-stats-1.PNG',
    label: 'Chess.com ratings list',
    story: 'screens-matchmaking-ratings--per-speed',
    storyTitle: 'Screens/Space/Matchmaking/Your ratings · Per speed',
  },
  {
    screenshot: 'flow-free-choose-pack-1.png',
    label: 'Flow Free pack list',
    story: 'screens-puzzle-packs-home--populated',
    storyTitle: 'Screens/Space/Puzzle packs/Home · Populated',
  },
  {
    screenshot: 'flow-free-choose-puzzle-1.png',
    label: 'Flow Free puzzle grid in a pack',
    story: 'screens-games-numberlink-catalog--first-threads',
    storyTitle: 'Screens/Space/Boards/Numberlink/Catalog · First threads',
  },
  {
    screenshot: 'flow-free-play-puzzle-1.png',
    label: 'Flow Free puzzle in play',
    story: 'screens-games-numberlink-puzzle--fresh',
    storyTitle: 'Screens/Space/Boards/Numberlink/Puzzle · Fresh',
  },
  {
    screenshot: 'flow-free-play-puzzle-2.PNG',
    label: 'Flow Free puzzle partly linked',
    story: 'screens-games-numberlink-puzzle--in-progress',
    storyTitle: 'Screens/Space/Boards/Numberlink/Puzzle · In progress',
  },
  {
    screenshot: 'flow-free-endgame-modal-1.PNG',
    label: 'Flow Free level complete',
    story: 'screens-games-numberlink-puzzle--next-puzzle',
    storyTitle: 'Screens/Space/Boards/Numberlink/Puzzle · Next puzzle',
  },
  {
    screenshot: 'unblockme-choose-puzzle-1.PNG',
    label: 'Unblock Me puzzle list',
    story: 'screens-games-sokoban-catalog--first-warehouse',
    storyTitle: 'Screens/Space/Boards/Sokoban/Catalog · First warehouse',
  },
  {
    screenshot: 'unblockme-play-puzzle-1.PNG',
    label: 'Unblock Me puzzle in play',
    story: 'screens-games-sokoban-puzzle--fresh',
    storyTitle: 'Screens/Space/Boards/Sokoban/Puzzle · Fresh',
  },
  {
    screenshot: 'barricade-matchmaking-1.PNG',
    label: 'Barricade matched game',
    story: 'screens-games-quoridor-classic--your-turn',
    storyTitle: 'Screens/Space/Boards/Quoridor/Classic · Your turn',
  },
  {
    screenshot: 'barricade-matchmaking-endgame-modal.PNG',
    label: 'Barricade game over',
    story: 'screens-matchmaking-result--after-the-game',
    storyTitle: 'Screens/Space/Matchmaking/Result · After the game',
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
