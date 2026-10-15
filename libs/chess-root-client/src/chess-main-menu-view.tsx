import { CustomGameScreen } from '@libs/chess-custom-game-client/custom-game-screen';
import MultiplayerScreen from '@libs/chess-matchmaking-client/multiplayer-screen';
import { LINKED_MULTIPLAYER_PARAM } from '@libs/chess-matchmaking-shared/multiplayer-link';
import { ChessPuzzleFeedProvider } from '@libs/chess-puzzle-client/chess-puzzle-feed-provider';
import { PuzzlePlayScreen } from '@libs/chess-puzzle-client/chess-puzzle-play-screen';
import { ChessPuzzleReviewScreen } from '@libs/chess-puzzle-client/chess-puzzle-review-screen';
import { ChessStatsScreen } from '@libs/chess-puzzle-client/chess-stats-screen';
import { PuzzleManagementScreen } from '@libs/chess-puzzle-client/puzzle-management-screen';
import { useIsPuzzleDriver } from '@libs/chess-puzzle-client/use-puzzle-space-role';
import { LINKED_PUZZLE_PARAM } from '@libs/chess-puzzle-shared/puzzle-link';
import type { ChessMainMenuScreen } from '@libs/chess-root-shared/chess-main-menu';
import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
} from '@libs/chess-root-shared/chess-main-menu';
import { ChessSettingsDeveloperScreen } from '@libs/chess-shared-client/chess-settings-developer-screen';
import { ChessSettingsDeveloperUiComponentDetailScreen } from '@libs/chess-shared-client/chess-settings-developer-ui-component-detail-screen';
import { ChessSettingsDeveloperUiComponentsScreen } from '@libs/chess-shared-client/chess-settings-developer-ui-components-screen';
import { ChessSettingsScreen } from '@libs/chess-shared-client/chess-settings-screen';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import type { JSX } from 'solid-js';
import { createEffect, Match, Switch, untrack } from 'solid-js';

export type ChessMainMenuProps = {
  onBackToGames: () => void;
};

function ChessScreenContent(props: {
  screen: ChessMainMenuScreen;
  onBackToGames: () => void;
}): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  return (
    <Switch fallback={<RootMainMenu onBackToGames={props.onBackToGames} />}>
      <Match when={props.screen === CHESS_SCREEN.puzzle}>
        <PuzzlePlayScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.multiplayer}>
        <MultiplayerScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.customGame}>
        <CustomGameScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.stats}>
        <ChessStatsScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.statsReview}>
        <ChessPuzzleReviewScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.settings}>
        <ChessSettingsScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.settingsDeveloper}>
        <ChessSettingsDeveloperScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.settingsDeveloperPuzzles}>
        <DefineBackButton
          onPress={() =>
            dispatch(
              SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloper })
            )
          }
        />
        <PuzzleManagementScreen embedded />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.settingsDeveloperUi}>
        <ChessSettingsDeveloperUiComponentsScreen />
      </Match>
      <Match when={props.screen === CHESS_SCREEN.settingsDeveloperUiDetail}>
        <ChessSettingsDeveloperUiComponentDetailScreen />
      </Match>
    </Switch>
  );
}

/** A space opened from a puzzle link goes straight to the puzzle screen. */
function useOpenLinkedPuzzleScreen(screen: () => ChessMainMenuScreen): void {
  const params = useLocalSearchParams<{ puzzle?: string | undefined }>();
  const isDriver = useIsPuzzleDriver();
  const dispatch = useSpaceRoomDispatch();
  createEffect(() => {
    const linked = params()[LINKED_PUZZLE_PARAM];
    if (linked === undefined || !isDriver()) return;
    if (screen() === CHESS_SCREEN.puzzle) return;
    untrack(() =>
      dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.puzzle }))
    );
  });
}

/**
 * A space its host opened from the multiplayer link goes straight to
 * multiplayer chess — once, so Back still leads to the chess choices.
 */
function useOpenLinkedMultiplayerScreen(
  screen: () => ChessMainMenuScreen
): void {
  const params = useLocalSearchParams<{ multiplayer?: string | undefined }>();
  const isHost = useIsPuzzleDriver();
  const dispatch = useSpaceRoomDispatch();
  let opened = false;
  createEffect(() => {
    if (params()[LINKED_MULTIPLAYER_PARAM] === undefined || !isHost()) return;
    if (opened) return;
    opened = true;
    if (untrack(screen) === CHESS_SCREEN.multiplayer) return;
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.multiplayer }));
  });
}

function ChessScreenSwitch(props: ChessMainMenuProps): JSX.Element {
  const screen = useSpaceRoomSelector(ChessMainMenuScreenAttr.screen.from);
  useOpenLinkedPuzzleScreen(screen);
  useOpenLinkedMultiplayerScreen(screen);

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
  return (
    <ChessPuzzleFeedProvider>
      <div class="box flex-1 min-h-0 self-stretch">
        <ChessScreenSwitch onBackToGames={props.onBackToGames} />
      </div>
    </ChessPuzzleFeedProvider>
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
      caption: <Trans>Rating trend and game log</Trans>,
      dataSet: { testid: 'chess-menu-stats' },
      onClick: () =>
        dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.stats })),
    },
    {
      key: 'custom-games',
      title: <Trans>Custom Games</Trans>,
      caption: <Trans>White vs Black — play, invite or watch</Trans>,
      dataSet: { testid: 'chess-menu-custom-game' },
      onClick: () =>
        dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.customGame })),
    },
    {
      key: 'matchmaking',
      title: <Trans>Multiplayer chess</Trans>,
      caption: <Trans>Find an opponent and watch together</Trans>,
      dataSet: { testid: 'chess-menu-multiplayer' },
      onClick: () =>
        dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.multiplayer })),
    },
    {
      key: 'settings',
      dataSet: { testid: 'chess-menu-settings' },
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
