import { Box, Text, useTheme } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { ChessPuzzleGameLogEntry } from '../../shared/chess-puzzle-stats';
import { ChessGameLogRow } from './chess-game-log-row';

export type ChessGameLogProps = {
  entries: readonly ChessPuzzleGameLogEntry[];
  onSelectEntry: (entry: ChessPuzzleGameLogEntry) => void;
};

export function ChessGameLog({
  entries,
  onSelectEntry,
}: ChessGameLogProps): ReactNode {
  const theme = useTheme();
  if (entries.length === 0) {
    return (
      <Text
        variant="body"
        style={{ color: theme.colors.textSecondary }}
        label={<Trans>No puzzles played yet.</Trans>}
      />
    );
  }
  return (
    <Box sx={{ gap: 2, alignSelf: 'stretch' }}>
      {entries.map((entry) => (
        <ChessGameLogRow
          key={`${entry.puzzleId}-${entry.at}`}
          entry={entry}
          onPress={() => onSelectEntry(entry)}
        />
      ))}
    </Box>
  );
}
