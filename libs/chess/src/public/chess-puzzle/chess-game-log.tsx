import { Trans } from '@lingui/solid/macro';
import { Box, Text } from '@pkgs/ui';
import { For, type JSX, Show } from 'solid-js';

import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';
import { ChessGameLogRow } from './chess-game-log-row';

export type ChessGameLogProps = {
  entries: readonly ChessPuzzleGameLogEntry[];
  onSelectEntry: (entry: ChessPuzzleGameLogEntry) => void;
};

export function ChessGameLog(props: ChessGameLogProps): JSX.Element {
  return (
    <Show
      when={props.entries.length > 0}
      fallback={
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          label={<Trans>No puzzles played yet.</Trans>}
        />
      }
    >
      <Box sx={{ gap: 2, alignSelf: 'stretch' }}>
        <For each={props.entries}>
          {(entry) => (
            <ChessGameLogRow
              entry={entry}
              onClick={() => props.onSelectEntry(entry)}
            />
          )}
        </For>
      </Box>
    </Show>
  );
}
