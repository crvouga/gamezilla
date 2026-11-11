/**
 * What the puzzle play screen's small screens are given: plain data, a
 * status union per part and callbacks. `PuzzlePlayScreen` wires them to the
 * room; stories pass them as args.
 */

import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import type { HintStage } from '@libs/game-puzzle-shared-ts/hint-stage';
import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { SpeakingAvatarSpeaker } from '@pkgs/ui-root-client-ts/speaking-avatar';
import type { JSX } from 'solid-js';
import type { PuzzleMoveNavProps } from './puzzle-move-history-nav';
import type { PuzzlePlayPlace, PuzzlePlayStage } from './puzzle-play-places';
import type { PuzzleMoveWriting } from './use-puzzle-notation';

/** The coach's line in the status line. */
export type PuzzlePlayCoach = {
  readonly message: string;
  /** Changes when the position changes, so the same words are said again. */
  readonly contextKey?: string | undefined;
  /** Spec handles of a placed puzzle's line: what it observed and why. */
  readonly handles?:
    | {
        readonly observation: string;
        readonly purpose: string;
        readonly puzzleId: string;
      }
    | undefined;
};

/**
 * What the puzzle on the board did to the rating (§8): `'unrated'` for a
 * repeat (§9), the signed change once rated, or null while undecided.
 */
export type PuzzleShownRatingChange = 'unrated' | number | null;

/** The line played so far and how the board moves through it. */
export type PuzzleLineModel = {
  readonly plies: readonly PuzzleHistoryPly[];
  readonly selectedSolveIdx: number;
  /** A move can be chosen: the puzzle is being solved or is over. */
  readonly interactive: boolean;
  /** The solver is to move at the end of the line. */
  readonly awaiting: boolean;
  readonly writing: PuzzleMoveWriting;
  readonly nav: PuzzleMoveNavProps;
  readonly onSeek: (solveIdx: number) => void;
};

/**
 * `locked`: customizing the feed needs an account (`denial` says how);
 * `loading`: the saved settings are not read yet; `ready`: they can be set.
 */
export type PuzzleFeedSettingsStatus = 'locked' | 'loading' | 'ready';

/** The feed's themes a game offers, and how each reads. */
export type PuzzleFeedThemes = {
  readonly choices: readonly string[];
  readonly label: (theme: string) => string;
};

/**
 * The feed settings: what is saved (what the feed serves now) and the
 * draft the settings screens edit, kept apart until Done saves it.
 */
export type PuzzleFeedSettingsModel = {
  readonly status: PuzzleFeedSettingsStatus;
  /** Why the feed cannot be customized, for `locked`. */
  readonly denial?: DenialView | undefined;
  /** The saved settings; their words wait for `savedReady`. */
  readonly saved: PuzzleFeedConfig;
  readonly savedReady: boolean;
  /** The rating the saved feed targets. */
  readonly savedTarget: number;
  /** The settings being edited, unsaved. */
  readonly draft: PuzzleFeedConfig;
  /** The rating the draft would target. */
  readonly draftTarget: number;
  /** The player's own puzzle rating; 0 before it is known. */
  readonly profileRating: number;
  /** Puzzles matching the draft, of those on this device. */
  readonly matched: number;
  readonly total: number;
  /** The game's themes; null when it has none to choose from. */
  readonly themes: PuzzleFeedThemes | null;
  /** Patch the draft; nothing is saved until `onDone`. */
  readonly onChange: (patch: Partial<PuzzleFeedConfig>) => void;
  /** Save the draft and leave the settings. */
  readonly onDone: () => void;
};

/** Where copying the puzzle's link stands; `failed` can be tried again. */
export type PuzzleShareState = 'idle' | 'copied' | 'failed';

/** Sharing the puzzle on the board. */
export type PuzzleShareModel = {
  readonly state: PuzzleShareState;
  readonly onShare: () => void;
};

/** How the finished puzzle went, for its result. */
export type PuzzleResultModel = {
  /** The rated outcome; null for a skip, or before the rating is in. */
  readonly completion: PuzzleCompletion | null;
  /** The rating the result shows: the completion's rating after. */
  readonly displayRating: number;
  /** §8 "?" marker on the player's rating while it is still uncertain. */
  readonly provisional: boolean;
  /** The puzzle's own rating; 0 before it is known. */
  readonly puzzleRating: number;
  readonly themes: readonly string[];
};

export type PuzzlePlayScreenViewProps = {
  /** Where the feed stands (`puzzlePlayStageOf`). */
  readonly stage: PuzzlePlayStage;
  /** The small screen shown, one the stage allows. */
  readonly place: PuzzlePlayPlace;
  readonly onOpen: (place: PuzzlePlayPlace) => void;
  /** One step back, to the place behind this one. */
  readonly onBack: () => void;
  /** Opt-in width-driven board, with coaching and help after it on phones. */
  readonly boardSizing?: 'fit' | 'width' | undefined;
  readonly statusKind: PuzzleStatusKind;
  /** The solver's side as the game names it, once a position is shown. */
  readonly solverSide?: string | null | undefined;
  /**
   * The solver's last move was right and the line goes on: the turn pill
   * takes the success colour ("Correct · White to move").
   */
  readonly correct?: boolean | undefined;
  readonly coach: PuzzlePlayCoach;
  /** The coach's words are still being chosen. */
  readonly coachResolving?: boolean | undefined;
  /** Reads the coach's line aloud; silent without. */
  readonly speaker?: SpeakingAvatarSpeaker | undefined;
  /** Elapsed solve time; null hides the clock. */
  readonly elapsedMs: number | null;
  /** Watching someone else solve: the board and the status line only. */
  readonly spectator: boolean;
  /** Rated puzzles left today; empty when unlimited. */
  readonly allowanceLabel: string;
  readonly ratingChange: PuzzleShownRatingChange;
  /** Who suggested which move, while spectators suggest. */
  readonly legend?: JSX.Element;
  /** The game's board at `size` px, on the board's screens. */
  readonly board?: ((size: number) => JSX.Element) | undefined;
  readonly line: PuzzleLineModel;
  readonly status: SolveStatus;
  readonly hintStage: HintStage;
  /** The board shows an earlier move than the latest. */
  readonly canGoForward: boolean;
  readonly onHint: () => void;
  readonly onSolution: () => void;
  readonly onRetry: () => void;
  readonly onSkip: () => void;
  readonly onNext: () => void;
  /** The rated limit's resolved denial, for `limited`. */
  readonly denial?: DenialView | undefined;
  /** Drop history and theme filters so every synced puzzle is eligible. */
  readonly onIncludeAllPuzzles: () => void;
  readonly feed: PuzzleFeedSettingsModel;
  readonly result: PuzzleResultModel;
  /** Null while there is no puzzle to share. */
  readonly share: PuzzleShareModel | null;
  /** A refused change, said on every screen of the template. */
  readonly notices?: JSX.Element;
  /** Test-only pick probe (hidden). */
  readonly probe?: JSX.Element;
  /** Live regions and probes beside whichever screen shows. */
  readonly overlay?: JSX.Element;
};
