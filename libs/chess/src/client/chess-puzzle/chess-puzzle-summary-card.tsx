import { Trans } from '@lingui/react/macro';
import { AnimatedBox, Box, Text } from '@pkgs/ui';
import { USE_NATIVE_DRIVER } from '@pkgs/ui/animation/use-native-driver';
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { ChessPuzzleEloDelta } from './chess-puzzle-elo-delta';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';

function StreakBadge({ streak }: { streak: number }): ReactNode {
  const scale = useRef(new Animated.Value(0.85)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.85);
    glow.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(glow, {
          toValue: 0.4,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [glow, scale, streak]);

  return (
    <AnimatedBox
      sx={{
        transform: [{ scale }],
        opacity: glow.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      }}
    >
      <Box
        sx={{ px: 3, py: 1, borderRadius: 999, background: 'successSurface' }}
      >
        <Text
          variant="bodyBold"
          sx={{ color: 'success' }}
          label={<Trans>{streak} puzzle streak</Trans>}
        />
      </Box>
    </AnimatedBox>
  );
}

function SummaryMeta({
  completion,
}: {
  completion: PuzzleCompletion;
}): ReactNode {
  const streak = completion.streak;
  const puzzleRating = completion.puzzleRating;
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

function outcomeLabel(outcome: PuzzleCompletion['outcome']): ReactNode {
  if (outcome === 'solved') return <Trans>Puzzle solved!</Trans>;
  return <Trans>Puzzle abandoned</Trans>;
}

export type ChessPuzzleSummaryCardProps = {
  completion: PuzzleCompletion;
  displayRating: number;
  deltaPulse?: Animated.Value;
};

export function ChessPuzzleSummaryCard({
  completion,
  displayRating,
  deltaPulse,
}: ChessPuzzleSummaryCardProps): ReactNode {
  const isSolved = completion.outcome === 'solved';

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
        label={outcomeLabel(completion.outcome)}
      />
      <AnimatedBox
        sx={
          deltaPulse !== undefined
            ? { transform: [{ scale: deltaPulse }] }
            : undefined
        }
      >
        <ChessPuzzleEloDelta
          ratingBefore={completion.ratingBefore}
          ratingAfter={completion.ratingAfter}
          delta={completion.delta}
          displayRating={displayRating}
        />
      </AnimatedBox>
      <SummaryMeta completion={completion} />
    </Box>
  );
}
