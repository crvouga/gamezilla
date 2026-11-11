/**
 * The explicit state machine behind what lies over a game's board.
 *
 * A board is covered by nothing (`none`), by the versus card and its count
 * before a game this device watched begin (`versus`), by the result card
 * once the game is over (`outcome`), or by nothing again after the person
 * closed that card to look at the final board (`board`). Nothing else may
 * lie over a board, and only the events below move between them.
 */

/** What lies over the board. */
export type StageOverlay =
  | { readonly kind: 'none' }
  /** The versus card; `count` whole seconds are left, never below 1. */
  | { readonly kind: 'versus'; readonly count: number }
  /** The result card, over the final board. */
  | { readonly kind: 'outcome' }
  /** The game is over and the result card is closed. */
  | { readonly kind: 'board' };

export type StageOverlayEvent =
  /** This device watched the game go from set up to played. */
  | { readonly type: 'began' }
  /** A second of the count passed. */
  | { readonly type: 'tick' }
  /** The person pressed the versus card. */
  | { readonly type: 'skip' }
  /** The game is over. */
  | { readonly type: 'ended' }
  /** The person closed the result card. */
  | { readonly type: 'dismiss' }
  /** The person asked for the result again. */
  | { readonly type: 'show' }
  /** There is no game on the board any more (it is being set up again). */
  | { readonly type: 'reset' };

/** The seconds the versus card counts down from. */
export const VERSUS_COUNT = 3;

export const NO_STAGE_OVERLAY: StageOverlay = { kind: 'none' };

const OUTCOME: StageOverlay = { kind: 'outcome' };
const BOARD: StageOverlay = { kind: 'board' };

function afterTick(state: StageOverlay): StageOverlay {
  if (state.kind !== 'versus') return state;
  return state.count > 1
    ? { kind: 'versus', count: state.count - 1 }
    : NO_STAGE_OVERLAY;
}

/** Whether the game under the overlay is over. */
export function stageOverlayOver(state: StageOverlay): boolean {
  return state.kind === 'outcome' || state.kind === 'board';
}

/**
 * The overlay after `event`. An event that means nothing in a state leaves
 * it as it is, so a late tick or a second press never does harm.
 */
export function stageOverlayAfter(
  state: StageOverlay,
  event: StageOverlayEvent
): StageOverlay {
  switch (event.type) {
    case 'began':
      return state.kind === 'versus'
        ? state
        : { kind: 'versus', count: VERSUS_COUNT };
    case 'tick':
      return afterTick(state);
    case 'skip':
      return state.kind === 'versus' ? NO_STAGE_OVERLAY : state;
    case 'ended':
      return stageOverlayOver(state) ? state : OUTCOME;
    case 'dismiss':
      return state.kind === 'outcome' ? BOARD : state;
    case 'show':
      return state.kind === 'board' ? OUTCOME : state;
    case 'reset':
      return NO_STAGE_OVERLAY;
  }
}

/**
 * Where a game stands, as far as its overlay cares. `unknown` is a game
 * not read yet (or none at all): what follows it was not watched begin.
 */
export type StageOverlayPhase = 'unknown' | 'setup' | 'play' | 'over';

/**
 * The overlay a device opens a game on: the result over a game already
 * over, nothing over a game already being played (it did not watch it
 * begin) or still being set up.
 */
export function stageOverlayOpening(phase: StageOverlayPhase): StageOverlay {
  return phase === 'over' ? OUTCOME : NO_STAGE_OVERLAY;
}

/**
 * The event a change of phase is, on a device that watched it happen;
 * `null` when it is none (the same phase again).
 */
export function stageOverlayPhaseEvent(
  from: StageOverlayPhase,
  to: StageOverlayPhase
): StageOverlayEvent | null {
  if (from === to) return null;
  if (to === 'over') return { type: 'ended' };
  if (to === 'setup' || to === 'unknown') return { type: 'reset' };
  // A game found already being played was not watched begin.
  if (from === 'unknown') return null;
  // A rematch goes from over straight to play on some templates.
  return { type: 'began' };
}
