import type { Topic } from '@pkgs/pubsub/interface';

/** Broadcast topic for the shared chess puzzle catalog. */
export function chessPuzzlesTopic(): Topic {
  return 'system:chess_puzzles';
}

export function chessPuzzlesChannels(): Topic[] {
  return [chessPuzzlesTopic()];
}
