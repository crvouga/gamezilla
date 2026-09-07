import { Trans } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import { Box, Text } from '@pkgs/ui';
import {
  type Accessor,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
} from 'solid-js';

import { ChessPuzzleEloDelta } from './chess-puzzle-elo-delta';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';

function StreakBadge(props: { streak: number }): JSX.Element {
  const timers = useTimers();
  const [shown, setShown] = createSignal(false);

  createEffect(() => {
    void props.streak;
    setShown(false);
    const id = timers.setTimeout(() => setShown(true), 0);
    onCleanup(() => timers.clearTimeout(id));
  });

  return (
    <Box
      sx={{
        transform: [{ scale: shown() ? 1 : 0.85 }],
        opacity: shown() ? 1 : 0.85,
        transitionProperty: 'transform, opacity',
        transitionDuration: 'var(--ui-duration-slow)',
        transitionTimingFunction: 'var(--ui-easing-standard)',
      }}
    >
      <Box
        sx={{ px: 3, py: 1, borderRadius: 999, background: 'successSurface' }}
      >
        <Text
          variant="bodyBold"
          sx={{ color: 'success' }}
          label={<Trans>{props.streak} puzzle streak</Trans>}
        />
      </Box>
    </Box>
  );
}

function SummaryMeta(props: { completion: PuzzleCompletion }): JSX.Element {
  const streak = props.completion.streak;
  const puzzleRating = props.completion.puzzleRating;
  return (
    <Box sx={{ gap: 2, alignItems: 'center' }}>
      {streak > 1 ? <StreakBadge streak={streak} /> : null}
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Puzzle rating {puzzleRating}</Trans>}
      />
    </Box>
  );
}

function outcomeLabel(outcome: PuzzleCompletion['outcome']): JSX.Element {
  if (outcome === 'solved') return <Trans>Puzzle solved!</Trans>;
  return <Trans>Puzzle abandoned</Trans>;
}

export type ChessPuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  deltaPulse?: Accessor<number>;
};

export function ChessPuzzleSummaryCard(
  props: ChessPuzzleSummaryCardProps
): JSX.Element {
  const isSolved = props.completion.outcome === 'solved';
  const scale = (): number => props.deltaPulse?.() ?? 1;

  return (
    <Box
      sx={{
        gap: 3,
        p: 4,
        borderRadius: 8,
        alignSelf: 'stretch',
        background: 'surfaceElevated',
        borderWidth: 1,
        borderColor: 'border',
      }}
    >
      <Text
        variant="heading"
        sx={{
          color: isSolved ? 'success' : 'text',
          textAlign: 'center',
        }}
        label={outcomeLabel(props.completion.outcome)}
      />
      <Box
        sx={{
          transform: [{ scale: scale() }],
          transitionProperty: 'transform',
          transitionDuration: 'var(--ui-duration-fast)',
          transitionTimingFunction: 'var(--ui-easing-standard)',
        }}
      >
        <ChessPuzzleEloDelta
          ratingBefore={props.completion.ratingBefore}
          ratingAfter={props.completion.ratingAfter}
          delta={props.completion.delta}
          displayRating={props.displayRating}
        />
      </Box>
      <SummaryMeta completion={props.completion} />
    </Box>
  );
}
