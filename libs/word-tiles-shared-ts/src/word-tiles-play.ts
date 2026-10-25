import { type PublicAction, parseAction } from './word-tiles-action';
import { cellName } from './word-tiles-board';
import { evaluatePlacement, type PlacementScore } from './word-tiles-placement';
import {
  decodePosition,
  encodePosition,
  leadingSeats,
  type WordTilesEnding,
  type WordTilesPosition,
} from './word-tiles-position';
import { RULESET } from './word-tiles-ruleset';

/**
 * The public transition: the position after one recorded action, judged on
 * public information alone. The authority has already checked what only it
 * can (the tiles were the mover's, the words are in the pinned lexicon); this
 * checks everything else — the geometry, the score, refills, the scoreless
 * run, and that an action ends the game exactly when the rules say it does.
 */

export type PlayedAction = {
  readonly position: WordTilesPosition;
  /** The placement's scoring; `null` for a pass or an exchange. */
  readonly score: PlacementScore | null;
  readonly label: string;
};

/** How the game ends after a turn, when it does. */
export function endingAfter(
  rackLeft: number,
  bagLeft: number,
  scoreless: number
): WordTilesEnding | null {
  // Going out wins over a scoreless run when both would apply.
  if (rackLeft === 0 && bagLeft === 0) return 'out';
  return scoreless >= RULESET.scorelessTurnLimit ? 'scoreless' : null;
}

/** Final scores: rack values come off; going out, the mover gains them all. */
export function settledScores(
  scores: readonly number[],
  values: readonly number[],
  ending: WordTilesEnding,
  mover: number
): readonly number[] {
  const left = values.reduce((sum, v) => sum + v, 0);
  return scores.map((score, seat) =>
    ending === 'out' && seat === mover ? score + left : score - values[seat]!
  );
}

function plausibleEnd(
  values: readonly number[],
  racks: readonly number[]
): boolean {
  return (
    values.length === racks.length &&
    values.every((v, seat) =>
      racks[seat] === 0 ? v === 0 : v <= racks[seat]! * 10
    )
  );
}

type Turn = {
  readonly position: WordTilesPosition;
  readonly action: PublicAction;
  readonly racks: readonly number[];
  readonly bag: number;
  readonly gained: number;
  readonly score: PlacementScore | null;
  readonly board: string;
  readonly label: string;
};

function finishTurn(turn: Turn): PlayedAction | null {
  const { position, action, racks, bag } = turn;
  const mover = position.turn;
  const scoreless = turn.gained > 0 ? 0 : position.scoreless + 1;
  const ending = endingAfter(racks[mover]!, bag, scoreless);
  if ((ending === null) !== (action.end === null)) return null;
  if (action.end !== null && !plausibleEnd(action.end, racks)) return null;
  const scores = position.scores.map((s, seat) =>
    seat === mover ? s + turn.gained : s
  );
  return {
    score: turn.score,
    label: turn.label,
    position: {
      ...position,
      board: turn.board,
      racks,
      bag,
      scores:
        ending === null || action.end === null
          ? scores
          : settledScores(scores, action.end, ending, mover),
      turn: ending === null ? (mover + 1) % position.seats : mover,
      scoreless: Math.min(scoreless, RULESET.scorelessTurnLimit),
      ended: ending,
    },
  };
}

function placementLabel(score: PlacementScore, first: number): string {
  const words = score.words.map((w) => w.word).join(' ');
  return `${words} ${cellName(first)} ${score.total}`;
}

/** The position after `action`, or `null` when the rules refuse it. */
export function playAction(
  position: WordTilesPosition,
  action: PublicAction
): PlayedAction | null {
  if (position.ended !== null) return null;
  const mover = position.turn;
  const rack = position.racks[mover]!;
  const base = { position, action, board: position.board, score: null };
  if (action.kind === 'pass')
    return finishTurn({
      ...base,
      racks: position.racks,
      bag: position.bag,
      gained: 0,
      label: 'pass',
    });
  if (action.kind === 'exchange') {
    if (position.bag < RULESET.exchangeMinimumBag || action.count > rack)
      return null;
    return finishTurn({
      ...base,
      racks: position.racks,
      bag: position.bag,
      gained: 0,
      label: `exchange ${action.count}`,
    });
  }
  if (action.placed.length > rack) return null;
  const evaluation = evaluatePlacement(position.board, action.placed);
  if (!evaluation.ok) return null;
  const drawn = Math.min(action.placed.length, position.bag);
  return finishTurn({
    ...base,
    board: evaluation.board,
    score: evaluation.score,
    gained: evaluation.score.total,
    racks: position.racks.map((r, seat) =>
      seat === mover ? r - action.placed.length + drawn : r
    ),
    bag: position.bag - drawn,
    label: placementLabel(evaluation.score, action.placed[0]!.cell),
  });
}

/** `playAction` on the written forms; `null` for anything malformed or refused. */
export function playEncoded(
  positionText: string,
  actionText: string
): { readonly position: string; readonly played: PlayedAction } | null {
  const position = decodePosition(positionText);
  const action = parseAction(actionText);
  if (position === null || action === null) return null;
  const played = playAction(position, action);
  return played === null
    ? null
    : { position: encodePosition(played.position), played };
}

/** The winning seats of an ended game: one, or several sharing the lead. */
export function winningSeats(position: WordTilesPosition): readonly number[] {
  return position.ended === null ? [] : leadingSeats(position);
}
