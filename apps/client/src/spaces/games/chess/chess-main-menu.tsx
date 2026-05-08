import { ChessArtwork } from '@gamezilla/client/spaces/games/chess/chess-artwork';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import { useSpaceSessionUi } from '@gamezilla/client/spaces/layout/space-session-ui-context';
import {
  useSpaceDispatch,
  useSpaceSelector,
} from '@gamezilla/client/spaces/room/use-space-room-selector';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
import {
  CHESS_MAIN_MENU_PUZZLE,
  CHESS_MAIN_MENU_ROOT,
  ChessMainMenuScreenAttr,
  SelectGame,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/space-module';
import { Button } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

function chessMenuArtwork() {
  return <ChessArtwork size={120} />;
}

function useRootItems(openPuzzleMenu: () => void): readonly MainMenuItem[] {
  return useMemo(
    (): readonly MainMenuItem[] => [
      {
        key: 'puzzle',
        title: <Trans>Puzzle</Trans>,
        onPress: openPuzzleMenu,
        showDisclosure: true,
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
    ],
    [openPuzzleMenu]
  );
}

const PUZZLE_ITEMS: readonly MainMenuItem[] = [
  {
    key: 'daily-puzzle',
    title: <Trans>Daily Puzzle</Trans>,
    caption: <Trans>Coming soon</Trans>,
    disabled: true,
  },
  {
    key: 'practice-puzzles',
    title: <Trans>Practice Puzzles</Trans>,
    caption: <Trans>Coming soon</Trans>,
    disabled: true,
  },
];

function BackButton({
  title,
  onPress,
}: {
  title: ReactNode;
  onPress: () => void;
}) {
  return <Button title={title} variant="outlined" onPress={onPress} />;
}

export function ChessMainMenu(): ReactNode {
  const { t } = useLingui();
  const { spaceId } = useSpaceSessionUi();
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const screen = useSpaceSelector(ChessMainMenuScreenAttr.screen.from);
  const dispatch = useSpaceDispatch();
  const onBackToGames = useCallback(() => {
    dispatch(SelectGame({ game: null }));
  }, [dispatch]);
  const openPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE }));
  }, [dispatch]);
  const backToChessRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_ROOT }));
  }, [dispatch]);
  const rootItems = useRootItems(openPuzzleMenu);

  if (screen === CHESS_MAIN_MENU_PUZZLE) {
    return (
      <MainMenuScreen
        artwork={chessMenuArtwork()}
        title={<Trans>Puzzle</Trans>}
        subtitle={<Trans>Pick a puzzle mode.</Trans>}
        items={PUZZLE_ITEMS}
        footer={
          <BackButton title={t`Back to chess menu`} onPress={backToChessRoot} />
        }
      />
    );
  }

  return (
    <MainMenuScreen
      artwork={chessMenuArtwork()}
      title={<Trans>Chess main menu</Trans>}
      subtitle={<Trans>Choose how you want to play.</Trans>}
      items={rootItems}
      footer={
        isHost ? (
          <BackButton
            title={t`Pick a different game`}
            onPress={onBackToGames}
          />
        ) : null
      }
    />
  );
}
