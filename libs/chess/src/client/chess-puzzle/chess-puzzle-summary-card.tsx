import { Box, Button, Text, useTheme } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { ChessPuzzleEloDelta } from './chess-puzzle-elo-delta';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';

function outcomeLabel(outcome: PuzzleCompletion['outcome']): ReactNode {
  if (outcome === 'solved') return <Trans>Puzzle solved!</Trans>;
  return <Trans>Puzzle abandoned</Trans>;
}

function SummaryMeta({ completion }: { completion: PuzzleCompletion }): ReactNode {
  const theme = useTheme();
  const streak = completion.streak;
  const puzzleRating = completion.puzzleRating;
  return (
    <Box sx={{ gap: 1, alignItems: 'center' }}>
      {streak > 1 ? (
        <Text
          variant="body"
          style={{ color: theme.colors.textSecondary }}
          label={<Trans>{streak} puzzle streak</Trans>}
        />
      ) : null}
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary }}
        label={<Trans>Puzzle rating {puzzleRating}</Trans>}
      />
    </Box>
  );
}

export type ChessPuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  onContinue: () => void;
  onRetry: () => void;
};

export function ChessPuzzleSummaryCard({
  completion,
  onContinue,
  onRetry,
}: ChessPuzzleSummaryCardProps): ReactNode {
  const theme = useTheme();
  return (
    <Box
      sx={{ gap: 3, p: 4, borderRadius: 8, alignSelf: 'stretch' }}
      style={{
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        variant="title"
        style={{ color: theme.colors.text, textAlign: 'center' }}
        label={outcomeLabel(completion.outcome)}
      />
      <ChessPuzzleEloDelta
        ratingBefore={completion.ratingBefore}
        ratingAfter={completion.ratingAfter}
        delta={completion.delta}
      />
      <SummaryMeta completion={completion} />
      <Box sx={{ flexDirection: 'row', gap: 2 }}>
        <Button flex={1} intent="neutral" title={<Trans>Retry</Trans>} onPress={onRetry} />
        <Button
          flex={1}
          intent="primary"
          title={<Trans>Continue</Trans>}
          onPress={onContinue}
        />
      </Box>
    </Box>
  );
}
