import { DefineBackButton } from '@libs/spaces/client/nav/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@pkgs/ui/components/main-menu-screen';
import { Trans } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
} from '../shared/chess-main-menu';
import { ChessBoardCanvasBootstrap } from '@pkgs/chess-board/chess-board-canvas-bootstrap';
import { PuzzlePlayScreen } from './chess-puzzle/chess-puzzle-play-screen';
import { ChessSettingsDeveloperScreen } from './chess-settings/chess-settings-developer-screen';
import { ChessSettingsDeveloperUiComponentDetailScreen } from './chess-settings/chess-settings-developer-ui-component-detail-screen';
import { ChessSettingsDeveloperUiComponentsScreen } from './chess-settings/chess-settings-developer-ui-components-screen';
import { ChessSettingsScreen } from './chess-settings/chess-settings-screen';

export type ChessMainMenuProps = {
  /** Called by chess's root menu to return to the games picker. */
  onBackToGames: () => void;
};

function ChessScreenSwitch({ onBackToGames }: ChessMainMenuProps): ReactNode {
  const screen = useSpaceRoomSelector(ChessMainMenuScreenAttr.screen.from);

  switch (screen) {
    case CHESS_SCREEN.puzzle:
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
      return <RootMainMenu onBackToGames={onBackToGames} />;
  }
}

/**
 * Chess entry point. Wraps the entire chess subtree in
 * `ChessBoardCanvasBootstrap` so CanvasKit (web) and the Skia canvas chunk
 * start loading the moment the user opens any chess screen — by the time
 * they reach a board (puzzle play, picker preview, etc.) the chunk is
 * cached and the per-board mount reads it synchronously via the runtime
 * singleton (no Suspense flash).
 *
 * Bootstrap is mounted here — the highest point inside the chess package —
 * so `@apps/client` does not import any Skia code; non-chess routes never
 * pay the CanvasKit WASM load cost.
 *
 * `onBackToGames` is supplied by the games registry host
 * (`<GamesMainMenu>` in `@libs/spaces`) so chess never has to import
 * the spaces-specific `SelectGame` command.
 */
export function ChessMainMenu({
  onBackToGames,
}: ChessMainMenuProps): ReactNode {
  return (
    <ChessBoardCanvasBootstrap>
      <ChessScreenSwitch onBackToGames={onBackToGames} />
    </ChessBoardCanvasBootstrap>
  );
}

function RootMainMenu({ onBackToGames }: ChessMainMenuProps): ReactNode {
  const dispatch = useSpaceRoomDispatch();
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
    <>
      <DefineBackButton onPress={onBackToGames} />
      <MainMenuScreen
        title={<Trans>Chess</Trans>}
        subtitle={<Trans>Choose how you want to play.</Trans>}
        items={items}
      />
    </>
  );
}
