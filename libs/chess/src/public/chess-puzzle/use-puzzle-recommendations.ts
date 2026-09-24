import { useSpaceRoomSelector } from '@libs/spaces/public/room/use-space-room-selector';
import type { BoardArrow } from '@pkgs/chess-board/chess-board-types';
import { assignParticipantColors, resolveParticipantColor } from '@pkgs/collab';
import { type Accessor, createMemo } from 'solid-js';

import {
  type ChessPuzzleRecommendationEntry,
  recommendationArrows,
  sortedRecommendations,
} from '../../shared/puzzle-session/recommendations';
import { ChessPuzzlePlayAttr } from '../chess-puzzle-play';

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
