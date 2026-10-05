import { ChessPuzzlePlayAttr } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import type { ChessPuzzleRecommendationEntry } from '@libs/chess-puzzle-shared/recommendations';
import {
  recommendationArrows,
  sortedRecommendations,
} from '@libs/chess-puzzle-shared/recommendations';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import type { BoardArrow } from '@pkgs/chess-board-core-shared/types';
import {
  assignParticipantColors,
  resolveParticipantColor,
} from '@pkgs/collab-root-shared/participant-color';
import { type Accessor, createMemo } from 'solid-js';

/**
 * Suggestions other members made for the live position, plus the colours that
 * identify them (assigned over the recommender set so two suggesters never
 * share a palette slot).
 */
export function usePuzzleRecommendations(args: {
  readonly excludeMemberId: Accessor<string | null>;
}): {
  entries: Accessor<readonly ChessPuzzleRecommendationEntry[]>;
  arrows: Accessor<readonly BoardArrow[]>;
  colorFor: (memberId: string) => string;
} {
  const recommendations = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.recommendations.from
  );
  const colors = createMemo(() =>
    assignParticipantColors(Object.keys(recommendations()))
  );
  const colorFor = (memberId: string): string =>
    (colors().get(memberId) ?? resolveParticipantColor(memberId)).css;
  return {
    entries: createMemo(() => sortedRecommendations(recommendations())),
    arrows: createMemo(() =>
      recommendationArrows({
        recommendations: recommendations(),
        colorFor,
        excludeMemberId: args.excludeMemberId(),
      })
    ),
    colorFor,
  };
}
