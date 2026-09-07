import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { Box, FadeSwitch, type MainMenuItem, MainMenuScreen } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import {
  CHESS_SCREEN,
  type ChessMainMenuScreen,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
} from '../shared/chess/chess-main-menu';
import { PuzzlePlayScreen } from './chess-puzzle/chess-puzzle-play-screen';
import { ChessPuzzleReviewScreen } from './chess-puzzle/chess-puzzle-review-screen';
import { ChessStatsScreen } from './chess-puzzle/chess-stats-screen';
import { useChessPuzzleFeedSubscription } from './chess-puzzle/use-chess-puzzle-feed-subscription';
import { ChessSettingsDeveloperScreen } from './chess-settings/chess-settings-developer-screen';
import { ChessSettingsDeveloperUiComponentDetailScreen } from './chess-settings/chess-settings-developer-ui-component-detail-screen';
import { ChessSettingsDeveloperUiComponentsScreen } from './chess-settings/chess-settings-developer-ui-components-screen';
import { ChessSettingsScreen } from './chess-settings/chess-settings-screen';

export type ChessMainMenuProps = {
  onBackToGames: () => void;
};

function ChessScreenContent(props: {
  screen: ChessMainMenuScreen;
  onBackToGames: () => void;
}): JSX.Element {
  switch (props.screen) {
    case CHESS_SCREEN.puzzle:
      return <PuzzlePlayScreen />;
    case CHESS_SCREEN.stats:
      return <ChessStatsScreen />;
    case CHESS_SCREEN.statsReview:
      return <ChessPuzzleReviewScreen />;
    case CHESS_SCREEN.settings:
      return <ChessSettingsScreen />;
    case CHESS_SCREEN.settingsDeveloper:
      return <ChessSettingsDeveloperScreen />;
    case CHESS_SCREEN.settingsDeveloperUi:
      return <ChessSettingsDeveloperUiComponentsScreen />;
    case CHESS_SCREEN.settingsDeveloperUiDetail:
      return <ChessSettingsDeveloperUiComponentDetailScreen />;
    default:
      return <RootMainMenu onBackToGames={props.onBackToGames} />;
  }
}

function ChessScreenSwitch(props: ChessMainMenuProps): JSX.Element {
  const screen = useSpaceRoomSelector(ChessMainMenuScreenAttr.screen.from);

  return (
    <FadeSwitch stateKey={screen()}>
      <ChessScreenContent
        screen={screen()}
        onBackToGames={props.onBackToGames}
      />
    </FadeSwitch>
  );
}

export function ChessMainMenu(props: ChessMainMenuProps): JSX.Element {
  useChessPuzzleFeedSubscription();
  return (
    <Box sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch' }}>
      <ChessScreenSwitch onBackToGames={props.onBackToGames} />
    </Box>
  );
}

function RootMainMenu(props: ChessMainMenuProps): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const items: readonly MainMenuItem[] = [
    {
      key: 'puzzle',
      title: <Trans>Puzzle</Trans>,
      caption: <Trans>Solve rated puzzles and climb the ladder</Trans>,
      dataSet: { testid: 'chess-menu-puzzle' },
      onClick: () =>
        dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle })),
    },
    {
      key: 'stats',
      title: <Trans>Stats</Trans>,
      caption: <Trans>Elo trend and game log</Trans>,
      dataSet: { testid: 'chess-menu-stats' },
      onClick: () =>
        dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.stats })),
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
      caption: <Trans>Preferences and developer tools</Trans>,
      onClick: () =>
        dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.settings })),
    },
  ];
  return (
    <>
      <DefineBackButton onPress={props.onBackToGames} />
      <MainMenuScreen
        screenId="chess-main-menu"
        title={<Trans>Chess</Trans>}
        subtitle={<Trans>Choose how you want to play.</Trans>}
        items={items}
      />
    </>
  );
}
