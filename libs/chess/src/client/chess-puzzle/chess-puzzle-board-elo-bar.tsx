import { useMyId } from '@libs/auth/client/use-current-user';
import { Trans } from '@lingui/react/macro';
import { Box, Pressable, Text, useTheme } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

import { resolveEffectivePuzzleRating } from '../../shared/chess-puzzle-feed-config';
import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

/** Fixed reserve so the board frame can fit the square under this bar. */
export const BOARD_ELO_BAR_HEIGHT = 44;

export type ChessPuzzleBoardEloBarProps = {
  rating?: number | undefined;
  onOpenFeedSettings: () => void;
};

export function ChessPuzzleBoardEloBar({
  rating,
  onOpenFeedSettings,
}: ChessPuzzleBoardEloBarProps): ReactNode {
  const theme = useTheme();
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [config] = useChessPuzzleFeedConfig();
  const effectiveRating = useMemo(
    () => resolveEffectivePuzzleRating({ config, profileRating }),
    [config, profileRating]
  );
  const feedLabel =
    config.mode === 'auto' ? (
      <Trans>Auto · {effectiveRating}</Trans>
    ) : (
      <Trans>Custom · {effectiveRating}</Trans>
    );
  const showPuzzleRating = rating !== undefined && rating > 0;
  const puzzleElo = showPuzzleRating ? rating : 0;

  return (
    <Box
      testID="chess-puzzle-board-elo-bar"
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        height: BOARD_ELO_BAR_HEIGHT,
        alignSelf: 'stretch',
      }}
    >
      {showPuzzleRating ? (
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            label={<Trans>Puzzle</Trans>}
          />
          <ChessPuzzleEloChip
            elo={puzzleElo}
            variant="muted"
            testID="chess-puzzle-board-elo"
          />
        </Box>
      ) : null}
      <Pressable
        onPress={onOpenFeedSettings}
        accessibilityRole="button"
        testID="chess-puzzle-feed-summary"
      >
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary }}
          label={feedLabel}
        />
      </Pressable>
    </Box>
  );
}
