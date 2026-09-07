import { Trans } from '@lingui/solid/macro';
import {
  Box,
  ChevronRightIcon,
  CircleCheckIcon,
  Clickable,
  Text,
  useRelativeTimeLabel,
  useTheme,
  XIcon,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import type { ChessPuzzleGameLogEntry } from '../chess-puzzle-stats';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function GameLogTitle(props: {
  solved: boolean;
  puzzleRating: number;
}): JSX.Element {
  if (props.solved) return <Trans>Solved · {props.puzzleRating}</Trans>;
  return <Trans>Abandoned · {props.puzzleRating}</Trans>;
}

function GameLogCaption(props: {
  puzzleId: string;
  timeLabel: string;
}): JSX.Element {
  return (
    <Trans>
      {props.puzzleId} · {props.timeLabel}
    </Trans>
  );
}

export type ChessGameLogRowProps = {
  entry: ChessPuzzleGameLogEntry;
  onClick: () => void;
};

export function ChessGameLogRow(props: ChessGameLogRowProps): JSX.Element {
  const theme = useTheme();
  const solved = props.entry.outcome === 'solved';
  const puzzleRating = props.entry.puzzleRating;
  const timeLabel = useRelativeTimeLabel(() => props.entry.at);
  const deltaColor =
    props.entry.delta > 0
      ? theme.colors.success
      : props.entry.delta < 0
        ? theme.colors.destructive
        : theme.colors.textSecondary;
  const Icon = solved ? CircleCheckIcon : XIcon;

  return (
    <Clickable
      onClick={props.onClick}
      role="button"
      dataSet={{ testid: `chess-game-log-row-${props.entry.puzzleId}` }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          p: 3,
          borderRadius: 8,
          background: 'surfaceMuted',
        }}
      >
        <Icon size={18} color={solved ? 'success' : 'destructive'} />
        <Box sx={{ flex: 1, gap: 1 }}>
          <Text
            variant="bodyBold"
            sx={{ color: 'text' }}
            label={<GameLogTitle solved={solved} puzzleRating={puzzleRating} />}
          />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={
              <GameLogCaption
                puzzleId={props.entry.puzzleId}
                timeLabel={timeLabel()}
              />
            }
          />
        </Box>
        <Text
          variant="bodyBold"
          sx={{ color: deltaColor }}
          label={formatSignedDelta(props.entry.delta)}
        />
        <ChevronRightIcon size={20} color="icon" />
      </Box>
    </Clickable>
  );
}
