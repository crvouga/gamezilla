import { useMyId } from '@libs/auth/client/use-current-user';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Box, Pressable, Text } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

import {
  type ChessPuzzleFeedHistoryFilter,
  resolveEffectivePuzzleRating,
} from '../../shared/chess-puzzle-feed-config';
import { formatChessPuzzleThemeLabel } from '../../shared/chess-puzzle-theme-label';
import { ChessPuzzleEloChip } from './chess-puzzle-elo-chip';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useChessPuzzleFeedPoolStats } from './use-chess-puzzle-feed-pool-stats';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

export type ChessPuzzleFeedBarProps = {
  puzzleId?: string | undefined;
  rating?: number | undefined;
  onOpenFeedSettings: () => void;
};

function historyFilterLabel(filter: ChessPuzzleFeedHistoryFilter): string {
  switch (filter) {
    case 'any':
      return t`Any`;
    case 'neverSeen':
      return t`Unseen`;
    case 'seen':
      return t`Seen`;
    case 'failed':
      return t`Failed`;
  }
}

function themesSummary(themes: readonly string[]): string {
  if (themes.length === 0) return t`All themes`;
  if (themes.length === 1) {
    const first = themes[0];
    return first === undefined
      ? t`All themes`
      : formatChessPuzzleThemeLabel(first);
  }
  return t`${themes.length} themes`;
}

function FeedBarSep(): ReactNode {
  return <Text variant="caption" sx={{ color: 'textSecondary' }} label="·" />;
}

export function ChessPuzzleFeedBar({
  puzzleId,
  rating,
  onOpenFeedSettings,
}: ChessPuzzleFeedBarProps): ReactNode {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [config] = useChessPuzzleFeedConfig();
  const pool = useChessPuzzleFeedPoolStats();
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
  const idLabel =
    puzzleId !== undefined && puzzleId.length > 0 ? puzzleId : '—';
  const muted = { color: 'textSecondary' } as const;

  return (
    <Pressable
      onPress={onOpenFeedSettings}
      accessibilityRole="button"
      testID="chess-puzzle-feed-summary"
      sx={{ alignSelf: 'stretch' }}
    >
      <Box
        testID="chess-puzzle-board-elo-bar"
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 2,
          px: 3,
          py: 2,
          alignSelf: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        <Text variant="caption" sx={muted} label={idLabel} />
        {showPuzzleRating ? (
          <>
            <FeedBarSep />
            <ChessPuzzleEloChip
              elo={puzzleElo}
              variant="muted"
              testID="chess-puzzle-board-elo"
            />
          </>
        ) : null}
        <FeedBarSep />
        <Text variant="caption" sx={muted} label={feedLabel} />
        <FeedBarSep />
        <Text
          variant="caption"
          sx={muted}
          label={historyFilterLabel(config.historyFilter)}
        />
        <FeedBarSep />
        <Text
          variant="caption"
          sx={muted}
          label={themesSummary(config.themes)}
        />
        <FeedBarSep />
        <Text
          variant="caption"
          sx={muted}
          label={
            <Trans>
              {pool.matched} / {pool.total}
            </Trans>
          }
        />
      </Box>
    </Pressable>
  );
}
