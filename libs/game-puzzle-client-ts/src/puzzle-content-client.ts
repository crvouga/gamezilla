import type { Component } from 'solid-js';

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
  };
  readonly Preview?: Component<PuzzlePreviewProps>;
};
