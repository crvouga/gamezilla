import { deriveOutcomeScore } from './chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionKind,
  type ChessPuzzleInteractionRow,
} from './chess-puzzle-interaction-entities';
import { compareCodeUnit } from './code-unit-compare';

/** Default player rating before any rated puzzles. */
export const PUZZLE_ELO_DEFAULT = 1200;

export const PUZZLE_ELO_MIN = 400;
export const PUZZLE_ELO_MAX = 3000;

/** Games using provisional K before switching to stable K. */
export const PUZZLE_ELO_PROVISIONAL_GAMES = 20;

export const PUZZLE_ELO_K_PROVISIONAL = 40;
export const PUZZLE_ELO_K_STABLE = 20;

/** Unused profile RD stub — Elo no longer depends on RD. */
export const PUZZLE_PROFILE_RD_STUB = 0;

export type PuzzleRatingScore = 0 | 0.5 | 1;

export type PuzzleRatingInput = {
  readonly playerRating: number;
  readonly puzzleRating: number;
  readonly score: PuzzleRatingScore;
  readonly ratedGames: number;
};

export type PuzzleRatingResult = {
  readonly rating: number;
};

export type ProjectedPuzzleEloEntry = {
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly outcome: 'solved' | 'abandoned';
  readonly ratingBefore: number;
  readonly ratingAfter: number;
  readonly delta: number;
  readonly at: string;
};

export type ProjectedPuzzleElo = {
  readonly rating: number;
  readonly ratedGames: number;
  readonly entries: readonly ProjectedPuzzleEloEntry[];
  readonly eloSeries: readonly number[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isTerminalKind(kind: ChessPuzzleInteractionKind): boolean {
  return (
    kind === CHESS_PUZZLE_INTERACTION_KIND.solved ||
    kind === CHESS_PUZZLE_INTERACTION_KIND.abandoned
  );
}

/** K-factor: higher while provisional, then stable. */
export function puzzleEloK(ratedGames: number): number {
  return ratedGames < PUZZLE_ELO_PROVISIONAL_GAMES
    ? PUZZLE_ELO_K_PROVISIONAL
    : PUZZLE_ELO_K_STABLE;
}

/**
 * Classic Elo step for one puzzle outcome.
 * `score`: 1 = clean solve, 0.5 = solved with hint/wrong move, 0 = abandoned.
 */
export function updatePuzzleRating(
  input: PuzzleRatingInput
): PuzzleRatingResult {
  const expected =
    1 / (1 + 10 ** ((input.puzzleRating - input.playerRating) / 400));
  const k = puzzleEloK(input.ratedGames);
  const next = Math.round(input.playerRating + k * (input.score - expected));
  return { rating: clamp(next, PUZZLE_ELO_MIN, PUZZLE_ELO_MAX) };
}

/** Play rows for a terminal at `terminalIndex` in chronologically sorted history. */
function playForTerminal(
  sorted: readonly ChessPuzzleInteractionRow[],
  terminalIndex: number
): readonly ChessPuzzleInteractionRow[] {
  const terminal = sorted[terminalIndex];
  if (terminal === undefined) return [];
  const puzzleId = terminal.puzzleId;
  let startIdx = -1;
  for (let i = terminalIndex; i >= 0; i -= 1) {
    const row = sorted[i];
    if (
      row !== undefined &&
      row.puzzleId === puzzleId &&
      row.kind === CHESS_PUZZLE_INTERACTION_KIND.started
    ) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return [terminal];
  const play: ChessPuzzleInteractionRow[] = [];
  for (let i = startIdx; i <= terminalIndex; i += 1) {
    const row = sorted[i];
    if (row !== undefined && row.puzzleId === puzzleId) play.push(row);
  }
  return play;
}

/**
 * Project Elo from attempt facts only. Formula edits change every delta
 * without backfill — interactions never store before/after ratings.
 */
export function projectPuzzleEloFromInteractions(
  interactions: readonly ChessPuzzleInteractionRow[]
): ProjectedPuzzleElo {
  const sorted = [...interactions].sort((a, b) => compareCodeUnit(a.at, b.at));
  let rating = PUZZLE_ELO_DEFAULT;
  let ratedGames = 0;
  const entries: ProjectedPuzzleEloEntry[] = [];
  const eloSeries: number[] = [rating];

  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    if (row === undefined || !isTerminalKind(row.kind)) continue;
    const play = playForTerminal(sorted, i);
    const ratingBefore = rating;
    const updated = updatePuzzleRating({
      playerRating: ratingBefore,
      puzzleRating: row.puzzleRating,
      score: deriveOutcomeScore(play),
      ratedGames,
    });
    rating = updated.rating;
    ratedGames += 1;
    const outcome =
      row.kind === CHESS_PUZZLE_INTERACTION_KIND.solved
        ? 'solved'
        : 'abandoned';
    entries.push({
      puzzleId: row.puzzleId,
      puzzleRating: row.puzzleRating,
      outcome,
      ratingBefore,
      ratingAfter: rating,
      delta: rating - ratingBefore,
      at: row.at,
    });
    eloSeries.push(rating);
  }

  return { rating, ratedGames, entries, eloSeries };
}
