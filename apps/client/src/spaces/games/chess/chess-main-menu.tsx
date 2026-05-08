import { ChessArtwork } from '@gamezilla/client/spaces/games/chess/chess-artwork';
import {
  MainMenuScreen,
  type MainMenuItem,
} from '@gamezilla/client/spaces/games/main-menu-screen';
import { Button } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState, type ReactNode } from 'react';

const CHESS_MENU_ROOT = 0;
const CHESS_MENU_PUZZLE = 1;
type ChessMenuScreen = typeof CHESS_MENU_ROOT | typeof CHESS_MENU_PUZZLE;

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

function BackButton({ title, onPress }: { title: ReactNode; onPress: () => void }) {
  return <Button title={title} variant="outlined" onPress={onPress} />;
}

export function ChessMainMenu({
  isHost,
  onBackToGames,
}: {
  isHost: boolean;
  onBackToGames: () => void;
}): ReactNode {
  const { t } = useLingui();
  const [screen, setScreen] = useState<ChessMenuScreen>(CHESS_MENU_ROOT);
  const rootItems = useRootItems(() => setScreen(CHESS_MENU_PUZZLE));

  if (screen === CHESS_MENU_PUZZLE) {
    return (
      <MainMenuScreen
        artwork={chessMenuArtwork()}
        title={<Trans>Puzzle</Trans>}
        subtitle={<Trans>Pick a puzzle mode.</Trans>}
        items={PUZZLE_ITEMS}
        footer={
          <BackButton
            title={t`Back to chess menu`}
            onPress={() => setScreen(CHESS_MENU_ROOT)}
          />
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
          <BackButton title={t`Pick a different game`} onPress={onBackToGames} />
        ) : null
      }
    />
  );
}
