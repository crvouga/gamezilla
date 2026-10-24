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

/** Independent game rendering capabilities, with no board or turn assumptions. */
export type PuzzleContentClient = {
  readonly Player: Component<PuzzlePlayerProps>;
  readonly authoring?: {
    readonly initialDefinition: () => string;
    readonly Editor: Component<PuzzleEditorProps>;
  };
  readonly Preview?: Component<PuzzlePreviewProps>;
};
