import type { ChessBoardProps } from '@pkgs/chess-board-shared/chess-board-types';

export type ExampleConfig = ChessBoardProps & {
  /** Capabilities of the injected recording compositor, outside the board API. */
  readonly motionCapabilities?: {
    readonly reducedMotion?: boolean;
    readonly lowEnd?: boolean;
    readonly webAnimations?: boolean;
  };
};
