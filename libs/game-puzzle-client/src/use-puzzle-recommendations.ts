import { PuzzlePlayAttr } from '@libs/game-puzzle-shared/play-attr';
import type { PuzzleRecommendationEntry } from '@libs/game-puzzle-shared/recommendations';
import { sortedRecommendations } from '@libs/game-puzzle-shared/recommendations';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import {
  assignParticipantColors,
  resolveParticipantColor,
} from '@pkgs/collab-root-shared/participant-color';
import { type Accessor, createMemo } from 'solid-js';
import type { PuzzleSuggestion } from './puzzle-client';

/**
 * Suggestions other members made for the live position, plus the colours that
 * identify them (assigned over the recommender set so two suggesters never
 * share a palette slot).
 */
export function usePuzzleRecommendations(args: {
  readonly excludeMemberId: Accessor<string | null>;
}): {
  entries: Accessor<readonly PuzzleRecommendationEntry[]>;
  /** What the board draws: everyone's but the viewer's own (their drag shows it). */
  suggestions: Accessor<readonly PuzzleSuggestion[]>;
  colorFor: (memberId: string) => string;
} {
  const recommendations = useSpaceRoomSelector(
    PuzzlePlayAttr.recommendations.from
  );
  const colors = createMemo(() =>
    assignParticipantColors(Object.keys(recommendations()))
  );
  const colorFor = (memberId: string): string =>
    (colors().get(memberId) ?? resolveParticipantColor(memberId)).css;
  const entries = createMemo(() => sortedRecommendations(recommendations()));
  return {
    entries,
    suggestions: createMemo(() =>
      entries()
        .filter((entry) => entry.by !== args.excludeMemberId())
        .map((entry) => ({
          by: entry.by,
          from: entry.from,
          to: entry.to,
          color: colorFor(entry.by),
        }))
    ),
    colorFor,
  };
}
