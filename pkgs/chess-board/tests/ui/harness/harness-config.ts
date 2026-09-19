/**
 * Serializable scenario config for the chess board harness. The same config
 * mounts the harness in happy-dom (passed directly) and in a browser page
 * (JSON in the URL hash), so every scenario runs identically on both hosts.
 */

import type {
  BoardArrow,
  BoardOrientation,
  CellFeedback,
  CellHighlight,
  Square,
} from '@pkgs/chess-board/chess-board-types';

/** How the harness parent reacts to the board's `onMove`. */
export type HarnessParentMode =
  /** Parent applies the move and pushes the resulting FEN (live game). */
  | 'confirm'
  /** Parent keeps its FEN; the board holds the optimistic move. */
  | 'ignore';

export type HarnessBoardKind = 'smart' | 'controlled';

export type HarnessToggle =
  | 'interactive'
  | 'premoves'
  | 'animations'
  | 'showCoordinates'
  | 'highlightLastMove'
  | 'highlightLegalMoves'
  | 'enableUserArrows'
  | 'autoPromoteQueen';

export type HarnessConfig = {
  readonly board?: HarnessBoardKind;
  readonly testId?: string;
  readonly fen?: string;
  readonly orientation?: BoardOrientation;
  /** Fixed side in px; `null` fills the harness frame width. Default 320. */
  readonly size?: number | null;
  /** Harness frame width in px (what a fill-width board fills). Default 360. */
  readonly frameWidth?: number;
  readonly parent?: HarnessParentMode;
  /** FENs the parent pushes, one per `harness-next` tap (opponent replies). */
  readonly script?: readonly string[];
  readonly interactive?: boolean;
  readonly premoves?: boolean;
  readonly animations?: boolean;
  readonly showCoordinates?: boolean;
  readonly highlightLastMove?: boolean;
  readonly highlightLegalMoves?: boolean;
  readonly enableUserArrows?: boolean;
  readonly autoPromoteQueen?: boolean;
  readonly arrows?: readonly BoardArrow[];
  readonly cellHighlights?: Partial<Record<Square, CellHighlight>>;
  readonly cellFeedback?: Partial<Record<Square, CellFeedback>>;
};

export const HARNESS_BOARD_TEST_ID = 'board';

/** Harness chrome test ids (controls + logs around the board). */
export const HarnessIds = {
  root: 'harness',
  frame: 'harness-frame',
  next: 'harness-next',
  reject: 'harness-reject',
  flip: 'harness-flip',
  remount: 'harness-remount',
  unmount: 'harness-unmount',
  toggleArrows: 'harness-toggle-arrows',
  moves: 'harness-moves',
  sounds: 'harness-sounds',
  userArrows: 'harness-user-arrows',
  parentFen: 'harness-parent-fen',
  toggle: (name: HarnessToggle) => `harness-toggle-${name}`,
} as const;

export function encodeHarnessConfig(config: HarnessConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

export function decodeHarnessConfig(hash: string): HarnessConfig {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length === 0) return {};
  return JSON.parse(decodeURIComponent(raw)) as HarnessConfig;
}
