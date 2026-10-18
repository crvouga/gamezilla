/**
 * What a game offering puzzles supplies to the platform's puzzle screens
 * (`defineGameClient({ …, puzzles })`): the board a puzzle is solved and
 * reviewed on, and optionally its own words, choices, sounds and companion.
 * The platform owns every puzzle screen, the feed, the attempt, the room
 * and the records; the game only draws and describes.
 */

import type { PuzzleCompletion } from '@libs/game-puzzle-shared/completion';
import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import type { GameBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type { PuzzleMarks } from '@pkgs/turn-game-shared/game-puzzles';
import type { GameSide } from '@pkgs/turn-game-shared/game-rules';
import type { Accessor, JSX } from 'solid-js';

/** What the board marks on its cells. */
export type PuzzleBoardMarks = {
  /** The cell a wrong move ended on, while it awaits its retry. */
  readonly wrong: string | null;
  /** The cell a hint picks, while the solver is to move. */
  readonly hint: string | null;
  /** The solution move, once the hint shows it. */
  readonly solution: PuzzleMarks | null;
};

/** A watcher's suggested move, in the colour that identifies them. */
export type PuzzleSuggestion = {
  readonly by: string;
  readonly from: string;
  readonly to: string;
  readonly color: string;
};

/**
 * The puzzle board. `onAction` reports one of the game's actions; the
 * platform decides whether it is the host's move or a watcher's suggestion.
 */
export type PuzzleBoardProps = GameBoardProps & {
  readonly size: number;
  /** Solving (moves, marks, suggestions) or reviewing a line (read-only). */
  readonly mode: 'play' | 'review';
  /** In review: whether this position change slides (one step) or snaps. */
  readonly animated: boolean;
  /**
   * How long one move's slide takes, in ms (the platform stages the line's
   * moves to it); `null` for the board's own pace.
   */
  readonly moveMs: number | null;
  readonly marks: PuzzleBoardMarks;
  readonly suggestions: readonly PuzzleSuggestion[];
};

/** The attempt on the board, as the platform knows it. */
export type PuzzleAttempt = {
  readonly puzzleId: Accessor<string>;
  readonly status: Accessor<SolveStatus>;
  /** The stored line: the setup move, then the solver's and replies. */
  readonly line: Accessor<string>;
  readonly solveIdx: Accessor<number>;
  /** Bumps each time the board is laid out again (a retry, a new puzzle). */
  readonly layoutKey: Accessor<number>;
  /** The position the board shows (after the opponent's staged moves). */
  readonly position: Accessor<string | null>;
  readonly solverSide: Accessor<GameSide>;
  readonly hintStage: Accessor<HintStage>;
  /** The cells of the line's next solver move a hint shows. */
  readonly hintFrom: Accessor<string | null>;
  readonly hintTo: Accessor<string | null>;
  /** The line's next solver move, while solving. */
  readonly nextAction: Accessor<string | null>;
  readonly wrongAction: Accessor<string | null>;
  /** Whether the solver may move now. */
  readonly interactive: Accessor<boolean>;
  /** The opponent's staged reply is playing. */
  readonly opponentReplying: Accessor<boolean>;
  /** The solver stepped back from the latest position. */
  readonly viewingHistory: Accessor<boolean>;
  /** This person watches someone else's attempt. */
  readonly spectating: Accessor<boolean>;
  readonly spaceRole: Accessor<'host' | 'guest' | 'unknown'>;
  readonly statusKind: Accessor<string>;
  readonly clockElapsedMs: Accessor<number | null>;
  readonly rating: Accessor<number>;
  readonly themes: Accessor<readonly string[]>;
  /** Watchers' suggestions, `by:fromto`, comma separated, oldest first. */
  readonly suggestionsProbe: Accessor<string>;
  readonly completion: Accessor<PuzzleCompletion | null>;
};

/** One line the coach says about the attempt. */
export type PuzzleCoachLine = {
  /** What the line is about (`data-observation`). */
  readonly kind: string;
  readonly purpose: string;
  readonly puzzleId: string;
  /** Changes whenever the line should be said again. */
  readonly positionKey: string;
  readonly text: string;
};

/** Sounds and haptics for an attempt's moments. */
export type PuzzleFeedback = {
  readonly onCorrectMove: () => void;
  readonly onWrongMove: () => void;
  readonly onSolved: () => void;
  readonly onRatingComplete: (delta: number) => void;
};

export type GamePuzzlesClient = {
  /** The board a puzzle is solved and reviewed on. */
  readonly Board: (props: PuzzleBoardProps) => JSX.Element;
  /** What the coach says about the attempt; silent when absent. */
  readonly coach?: (attempt: PuzzleAttempt) => PuzzleCoachLine | null;
  /** Mounted beside the board: the game's own live region and probes. */
  readonly Companion?: (props: {
    readonly attempt: PuzzleAttempt;
  }) => JSX.Element;
  /** The themes a feed can be narrowed to, and how each reads. */
  readonly themes?: {
    readonly choices: readonly string[];
    readonly label: (theme: string) => string;
  };
  /**
   * How the move list writes a move: the game's notations (the first is
   * the default, and any stored notation the game does not know reads as
   * it), a move's text in one, and the number shown before a move.
   */
  readonly notation?: {
    readonly choices: readonly string[];
    readonly format: (label: string, notation: string) => string;
    readonly moveNumber?: (before: string, plyIndex: number) => string | null;
  };
  /** Sounds and haptics for a correct move, a wrong one, a solve, a rating. */
  readonly useFeedback?: () => PuzzleFeedback;
};
