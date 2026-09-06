import { Trans } from '@lingui/react/macro';
import { Box, Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';
import { ChessGameLogRow } from './chess-game-log-row';

export type ChessGameLogProps = {
  entries: readonly ChessPuzzleGameLogEntry[];
  onSelectEntry: (entry: ChessPuzzleGameLogEntry) => void;
};

export function ChessGameLog({
  entries,
  onSelectEntry,
}: ChessGameLogProps): ReactNode {
  if (entries.length === 0) {
    return (
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
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
