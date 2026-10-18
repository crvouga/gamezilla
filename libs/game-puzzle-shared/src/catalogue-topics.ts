import type { Topic } from '@pkgs/pubsub-root-shared/topic';

/**
 * Broadcast topic of the puzzle catalogue, every game's puzzles in one
 * stream (its name predates the other games and is kept).
 */
export function puzzleCatalogueTopic(): Topic {
  return 'system:chess_puzzles';
}

export function puzzleCatalogueChannels(): Topic[] {
  return [puzzleCatalogueTopic()];
}
