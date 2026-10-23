/** Complete, product-independent screen compositions in the UI explorer. */
import type { ComponentEntry } from '@pkgs/ui-root-shared-ts/component-entry';
import { entry } from '@pkgs/ui-root-shared-ts/component-entry';
import CollectionScreenExample from './collection-screen.example';
import ContentScreenExample from './content-screen.example';
import EmbeddedScreenExample from './embedded-screen.example';
import FormScreenExample from './form-screen.example';
import GameHistoryScreenExample from './game-history-screen.example';
import GameReviewScreenExample from './game-review-screen.example';
import GameScreenExample from './game-screen.example';
import MatchmakingScreenExample from './game-session-layout.example';
import GameSetupPanelExample from './game-setup-panel.example';
import MainMenuScreenExample from './main-menu-screen.example';
import MenuScreenExample from './menu-screen.example';
import ProfileScreenLayoutExample from './profile-screen-layout.example';
import PuzzleScreenExample from './puzzle-screen.example';

const SCREENS = 'Screen Layouts';
export const SCREEN_ENTRIES: readonly ComponentEntry[] = [
  entry('main-menu-screen', 'Main menu', SCREENS, MainMenuScreenExample),
  entry('game-screen', 'Custom game', SCREENS, GameScreenExample),
  entry(
    'game-session-layout',
    'Matchmaking game',
    SCREENS,
    MatchmakingScreenExample
  ),
  entry('game-setup-panel', 'Game setup', SCREENS, GameSetupPanelExample),
  entry('puzzle-screen', 'Puzzle play', SCREENS, PuzzleScreenExample),
  entry(
    'game-history-screen',
    'Game and puzzle history',
    SCREENS,
    GameHistoryScreenExample
  ),
  entry(
    'game-review-screen',
    'Game and puzzle review',
    SCREENS,
    GameReviewScreenExample
  ),
  entry('form-screen', 'Form editor', SCREENS, FormScreenExample),
  entry('menu-screen', 'Settings menu', SCREENS, MenuScreenExample),
  entry(
    'profile-screen-layout',
    'Profile',
    SCREENS,
    ProfileScreenLayoutExample
  ),
  entry(
    'collection-screen',
    'Search and collections',
    SCREENS,
    CollectionScreenExample
  ),
  entry(
    'content-screen',
    'Details and documents',
    SCREENS,
    ContentScreenExample
  ),
  entry('embedded-screen', 'Embedded content', SCREENS, EmbeddedScreenExample),
];
