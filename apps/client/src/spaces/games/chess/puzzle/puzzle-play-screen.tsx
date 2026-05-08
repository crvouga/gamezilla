import { Box, Text, useTheme } from '@gamezilla/lib/ui';
import { MainMenuScreen } from '@gamezilla/client/spaces/games/main-menu-screen';
import {
  CHESS_MAIN_MENU_PUZZLE,
  SetChessMainMenuScreen,
} from '@gamezilla/domain/spaces/space-module';
import { Trans } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

function PlaceholderChessBoard(): ReactNode {
  const theme = useTheme();
  const size = 320;
  const cell = size / 8;
  const light = theme.colors.surface;
  const dark = theme.colors.surface;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'border',
      }}
    >
      {Array.from({ length: 8 }).map((_, row) => (
        <Box key={row} sx={{ flexDirection: 'row' }}>
          {Array.from({ length: 8 }).map((__, col) => {
            const isDark = (row + col) % 2 === 1;
            return (
              <Box
                key={col}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: isDark ? dark : light,
                }}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

export function PuzzlePlayScreen(args: { dispatch: (cmd: unknown) => void }): ReactNode {
  const { dispatch } = args;

  const backToPuzzleMenu = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_MAIN_MENU_PUZZLE }));
  }, [dispatch]);

  return (
    <MainMenuScreen
      title={<Trans>Puzzle</Trans>}
      subtitle={<Trans>Play</Trans>}
      helper={
        <Box sx={{ alignItems: 'center', gap: 4, mt: 2 }}>
          <PlaceholderChessBoard />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', textAlign: 'center' }}
            label={<Trans>This is a placeholder puzzle board.</Trans>}
          />
        </Box>
      }
      items={[]}
      onPressBack={backToPuzzleMenu}
    />
  );
}

