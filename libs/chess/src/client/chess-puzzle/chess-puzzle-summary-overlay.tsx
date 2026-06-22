import { Animated } from 'react-native';
import type { ReactNode } from 'react';

import { ChessPuzzleSummaryCard } from './chess-puzzle-summary-card';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import { useSummaryOverlayAnimation } from './use-summary-overlay-animation';

export type ChessPuzzleSummaryOverlayProps = {
  completion: PuzzleCompletion;
  onContinue: () => void;
  onRetry: () => void;
};

export function ChessPuzzleSummaryOverlay({
  completion,
  onContinue,
  onRetry,
}: ChessPuzzleSummaryOverlayProps): ReactNode {
  const completionKey = `${completion.outcome}-${completion.ratingAfter}`;
  const { fade, slide } = useSummaryOverlayAnimation(completionKey);

  return (
    <Animated.View
      testID="chess-puzzle-summary"
      style={{
        opacity: fade,
        transform: [{ translateY: slide }],
        alignSelf: 'stretch',
      }}
    >
      <ChessPuzzleSummaryCard
        completion={completion}
        onContinue={onContinue}
        onRetry={onRetry}
      />
    </Animated.View>
  );
}
