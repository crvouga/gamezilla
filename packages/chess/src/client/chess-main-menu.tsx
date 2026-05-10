import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/spaces/client/main-menu-screen';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '@gamezilla/spaces/client/use-space-room-selector';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
} from '../shared/chess-main-menu';
import { SelectGame } from '@gamezilla/spaces/shared/games';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ChessBoardCanvasBootstrap } from './chess-board-canvas-bootstrap';
import { PuzzleMainMenu } from './chess-puzzle-main-menu';
import { PuzzlePickerScreen } from './chess-puzzle-picker-screen';
import { PuzzlePlayScreen } from './chess-puzzle-play-screen';
import { ChessSettingsDeveloperScreen } from './chess-settings-developer-screen';
import { ChessSettingsDeveloperUiComponentDetailScreen } from './chess-settings-developer-ui-component-detail-screen';
import { ChessSettingsDeveloperUiComponentsScreen } from './chess-settings-developer-ui-components-screen';
import { ChessSettingsScreen } from './chess-settings-screen';

function ChessScreenSwitch(): ReactNode {
  const screen = useSpaceSelector(ChessMainMenuScreenAttr.screen.from);

  switch (screen) {
    case CHESS_SCREEN.puzzle:
      return <PuzzleMainMenu />;
    case CHESS_SCREEN.puzzlePicker:
      return <PuzzlePickerScreen />;
    case CHESS_SCREEN.puzzlePlay:
      return <PuzzlePlayScreen />;
    case CHESS_SCREEN.settings:
      return <ChessSettingsScreen />;
    case CHESS_SCREEN.settingsDeveloper:
      return <ChessSettingsDeveloperScreen />;
    case CHESS_SCREEN.settingsDeveloperUi:
      return <ChessSettingsDeveloperUiComponentsScreen />;
    case CHESS_SCREEN.settingsDeveloperUiDetail:
      return <ChessSettingsDeveloperUiComponentDetailScreen />;
    default:
      return <RootMainMenu />;
  }
}

/**
 * Chess entry point. Wraps the entire chess subtree in
 * `ChessBoardCanvasBootstrap` so the Skia canvas chunk starts loading the
 * moment the user opens any chess screen — by the time they reach a board
 * (puzzle play, picker preview, etc.) the chunk is cached and the per-board
 * mount reads it synchronously via the runtime singleton (no Suspense flash).
 *
 * Bootstrap is mounted here — the highest point inside the chess package —
 * to keep `@gamezilla/client` decoupled from any feature package; the only
 * cross-package responsibility at the app root is `SkiaWebRoot`.
 */
export function ChessMainMenu(): ReactNode {
  return (
    <ChessBoardCanvasBootstrap>
      <ChessScreenSwitch />
    </ChessBoardCanvasBootstrap>
  );
}

function RootMainMenu(): ReactNode {
  const dispatch = useSpaceDispatch();
  const onBackToGames = useCallback(() => {
    dispatch(SelectGame({ game: null }));
  }, [dispatch]);
  const items = useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'puzzle',
        title: <Trans>Puzzle</Trans>,
        onPress: () =>
          dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle })),
      },
      {
        key: 'custom-games',
        title: <Trans>Custom Games</Trans>,
        caption: <Trans>Coming soon</Trans>,
        disabled: true,
      },
      {
        key: 'matchmaking',
        title: <Trans>Matchmaking</Trans>,
        caption: <Trans>Coming soon</Trans>,
        disabled: true,
      },
      {
        key: 'settings',
        title: <Trans>Settings</Trans>,
        caption: <Trans>Preferences and developer tools.</Trans>,
        onPress: () =>
          dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.settings })),
      },
    ],
    [dispatch]
  );
  return (
    <MainMenuScreen
      title={<Trans>Chess</Trans>}
      subtitle={<Trans>Choose how you want to play.</Trans>}
      items={items}
      onPressBack={onBackToGames}
    />
  );
}
