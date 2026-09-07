import { useMyId } from '@libs/auth/public/use-current-user';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Box, Clickable, Text } from '@pkgs/ui';
import { createMemo, type JSX, Show } from 'solid-js';

import {
  type ChessPuzzleFeedHistoryFilter,
  resolveEffectivePuzzleRating,
} from '../chess-puzzle-feed-config';
import { formatChessPuzzleThemeLabel } from '../chess-puzzle-theme-label';
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

function FeedBarSep(): JSX.Element {
  return <Text variant="caption" sx={{ color: 'textSecondary' }} label="·" />;
}

export function ChessPuzzleFeedBar(
  props: ChessPuzzleFeedBarProps
): JSX.Element {
  const myId = useMyId();
  const { profileRating } = useChessPuzzleProfileRatings(myId);
  const [config] = useChessPuzzleFeedConfig();
  const pool = useChessPuzzleFeedPoolStats();
  const effectiveRating = createMemo(() =>
    resolveEffectivePuzzleRating({ config: config(), profileRating })
  );
  const feedLabel = createMemo(() =>
    config().mode === 'auto' ? (
      <Trans>Auto · {effectiveRating()}</Trans>
    ) : (
      <Trans>Custom · {effectiveRating()}</Trans>
    )
  );
  const showPuzzleRating = () =>
    props.rating !== undefined && (props.rating ?? 0) > 0;
  const puzzleElo = () => (showPuzzleRating() ? (props.rating ?? 0) : 0);
  const idLabel =
    props.puzzleId !== undefined && props.puzzleId.length > 0
      ? props.puzzleId
      : '—';
  const muted = { color: 'textSecondary' } as const;

  return (
    <Clickable
      onClick={props.onOpenFeedSettings}
      role="button"
      dataSet={{ testid: 'chess-puzzle-feed-summary' }}
      sx={{ alignSelf: 'stretch' }}
    >
      <Box
        dataSet={{ testid: 'chess-puzzle-board-elo-bar' }}
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
        <Show when={showPuzzleRating()}>
          <FeedBarSep />
          <ChessPuzzleEloChip
            elo={puzzleElo()}
            variant="muted"
            testID="chess-puzzle-board-elo"
          />
        </Show>
        <FeedBarSep />
        <Text variant="caption" sx={muted} label={feedLabel()} />
        <FeedBarSep />
        <Text
          variant="caption"
          sx={muted}
          label={historyFilterLabel(config().historyFilter)}
        />
        <FeedBarSep />
        <Text
          variant="caption"
          sx={muted}
          label={themesSummary(config().themes)}
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
    </Clickable>
  );
}
