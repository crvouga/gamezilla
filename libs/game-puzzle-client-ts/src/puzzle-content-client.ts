import type { Component } from 'solid-js';
import { useContentGame } from './content-game-context';

/** Return from a game-owned board to its existing library, keeping its attempt. */
export function usePuzzleLibraryNavigation(): () => void {
  const game = useContentGame();
  return () => game.open({ kind: 'library' });
}

/** The shared player owns persistence, history, completion and navigation. */
export type PuzzlePlayerProps = {
  readonly definition: string;
  readonly state: string;
  readonly disabled: boolean;
  readonly onAction: (action: string) => void;
};

/** The shared builder owns metadata, saved copies, validation and publication. */
export type PuzzleEditorProps = {
  readonly definition: string;
  readonly disabled: boolean;
  readonly onChange: (definition: string) => void;
};

export type PuzzlePreviewProps = { readonly definition: string };

/**
 * What the shared solo frame around the player shows: a label for each
 * figure the content's `statistics` give (by its key), the content's own
 * status line (`null` for none) and, optionally, controls under the board.
 */
export type PuzzleContentFrame = {
  readonly stats: Readonly<Record<string, () => string>>;
  readonly turnStatus: (definition: string, state: string) => string | null;
  readonly controls?: Component<PuzzlePlayerProps>;
};

/** Independent game rendering capabilities, with no board or turn assumptions. */
export type PuzzleContentClient = {
  readonly Player: Component<PuzzlePlayerProps>;
  readonly frame: PuzzleContentFrame;
  readonly authoring?: {
    readonly initialDefinition: () => string;
    readonly Editor: Component<PuzzleEditorProps>;
    /**
     * Whether the editor can read a saved draft at all. A draft it cannot
     * read cannot be playtested; without this, every draft may try.
     */
    readonly readable?: ((definition: string) => boolean) | undefined;
  };
  readonly Preview?: Component<PuzzlePreviewProps>;
};
