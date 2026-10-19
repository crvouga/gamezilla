import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';

/** How the move list writes the game's moves, under the person's notation. */
export type PuzzleMoveWriting = {
  /** The notation in use: the stored one when the game offers it, else its first. */
  readonly notation: Accessor<string>;
  /** A move's text in that notation. */
  readonly format: (label: string) => string;
  /** The number shown before a move, as the game numbers its moves. */
  readonly moveNumber: (before: string, plyIndex: number) => string | null;
};

export function usePuzzleMoveWriting(): PuzzleMoveWriting {
  const { client } = usePuzzleGame();
  const [config] = usePuzzleFeedConfig();
  const choices = client.notation?.choices ?? [];
  const notation = createMemo(() => {
    const stored = config().notation;
    return choices.includes(stored) ? stored : (choices[0] ?? '');
  });
  return {
    notation,
    format: (label) => client.notation?.format(label, notation()) ?? label,
    moveNumber: (before, plyIndex) =>
      client.notation?.moveNumber?.(before, plyIndex) ?? null,
  };
}
