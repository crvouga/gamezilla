import type { GameBoardProps } from './game-presentation';
import type { GameSide, GameWinner } from './game-rules';
import { winningSides } from './game-rules';

/**
 * The shared game frame: everything the platform's frame around a board
 * (players, their seats, the turn line, options before play and the result
 * after it) needs from a game, as data. A game supplies the data and its own
 * board; the frame owns every layout. Copy is the game's own, already
 * translated: a `label` thunk is read where it is shown, never ahead.
 */

/** The most seats the frame shows (the engines seat at most `GAME_SIDES`). */
export const FRAME_SEAT_LIMIT = 8;
export type FrameSeatCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** A seat's player color, `n` for the design token `player<n>`. */
export type FramePlayerColor = FrameSeatCount;

/**
 * The paint of a board whose pieces are not drawn in player colors, named
 * for what is drawn: the first and second disc of a disc-drop board. A seat
 * painted with it matches its pieces on the board in every theme.
 */
export type FrameBoardPaint = 'disc-one' | 'disc-two';

/** Every board paint, in a stable order. */
export const FRAME_BOARD_PAINTS: readonly FrameBoardPaint[] = [
  'disc-one',
  'disc-two',
];

/** A seat's paint: a player color, or its board's own piece paint. */
export type FrameSeatPaint = FramePlayerColor | FrameBoardPaint;

/** How a seat is told apart: its paint, the board's own mark, or both. */
export type GameSeatLook =
  | { readonly color: FrameSeatPaint; readonly mark?: string }
  | { readonly color?: FrameSeatPaint; readonly mark: string };

/**
 * How many people a game seats. A game whose rules seat a fixed number has
 * `min`, `max` and `default` equal to it ({@link fixedPlayers}); a family
 * registering one mode per table size names each size's mode by its game id
 * in `modes`, so choosing a count switches to that mode.
 */
export type GamePlayers = {
  readonly min: FrameSeatCount;
  readonly max: FrameSeatCount;
  readonly default: FrameSeatCount;
  readonly modes?: Readonly<Partial<Record<FrameSeatCount, string>>>;
};

/** One choice of a choice option. */
export type GameOptionChoice = {
  readonly value: string;
  readonly label: () => string;
};

/**
 * One option chosen before play, read from and written to the position
 * through the rules' `configuration`: `read` gives the option's value in a
 * position, `encode` the configuration choice that sets a value.
 */
export type GameOptionGroup =
  | {
      readonly kind: 'choice';
      readonly id: string;
      readonly label: () => string;
      readonly options: readonly GameOptionChoice[];
      readonly default: string;
      readonly read: (position: string) => string;
      readonly encode: (value: string) => string;
    }
  | {
      readonly kind: 'count';
      readonly id: string;
      readonly label: () => string;
      readonly min: number;
      readonly max: number;
      readonly default: number;
      readonly read: (position: string) => number;
      readonly encode: (value: number) => string;
    };

/** The one figure a seat shows beside its name (a score, walls left). */
export type GameSeatStat = { readonly label: string; readonly value: string };

/** A seat's place in a finished game: 1 for every winner, ties sharing a place. */
export type GameStanding = {
  readonly side: GameSide;
  readonly place: number;
  readonly score: string | null;
};

/** What the frame shows once a game is over: each seat once, first place first. */
export type GameResultSummary = {
  /** What `score` counts (`Points`); `null` for a game without scores. */
  readonly scoreLabel: string | null;
  readonly standings: readonly GameStanding[];
};

/** One of the board's own actions, shown in the frame's action bar. */
export type GameFrameAction = {
  /** Rendered as `${testId}-${id}`. */
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly emphasis?: 'primary';
  /** For a tool that stays chosen (a mode): whether it is chosen now. */
  readonly pressed?: boolean;
  readonly run: () => void;
};

/** One seat of the game, as the frame shows it. */
export type GameFrameSeat = {
  readonly side: GameSide;
  readonly look: GameSeatLook;
};

/**
 * What the frame gives the board: everything a board is given, the side the
 * person sits on (`null` for a watcher) and every seat with its look.
 */
export type GameFrameBoardProps = GameBoardProps & {
  readonly viewer: GameSide | null;
  readonly seats: readonly GameFrameSeat[];
};

/**
 * The board the frame mounts: the board itself, the actions it offers in
 * the frame's action bar and, optionally, its own controls under the board.
 */
export type GameFrameBoardSession<View> = {
  readonly Board: () => View;
  readonly actions: () => readonly GameFrameAction[];
  readonly controls?: () => View;
};

export type GameFrame<View> = {
  readonly players: GamePlayers;
  /**
   * Whether the frame offers the people playing a draw by agreement among
   * its commands. A game says so itself: one that can never be drawn
   * (Battleship), one played in real time (Pong, Light Cycles) and one
   * whose table plays every hand out (Hearts) leave Offer draw out, so
   * their commands are only the ones that fit them.
   */
  readonly drawOffers: boolean;
  /** The options chosen before play; empty for a game without any. */
  readonly options: readonly GameOptionGroup[];
  readonly seats: {
    readonly look: (side: GameSide) => GameSeatLook;
    /** The seat's figure in `position`, or `null` for a game without one. */
    readonly stat: (position: string, side: GameSide) => GameSeatStat | null;
    /** Short public facts about the seat (`5 cards`, `Passed`). */
    readonly facts: (
      position: string,
      side: GameSide,
      committed: readonly GameSide[]
    ) => readonly string[];
    /** Whether the seat is out of play (crashed, eliminated) in `position`. */
    readonly out: (position: string, side: GameSide) => boolean;
  };
  readonly createBoard: (
    props: GameFrameBoardProps
  ) => GameFrameBoardSession<View>;
  /**
   * The game's own line about the turn (`Your turn to fire.`), for `viewer`
   * (`null` for a watcher), given the sides that have committed in the
   * phase open now; `null` leaves the frame's `<Side> to move.`.
   */
  readonly turnStatus: (
    position: string,
    viewer: GameSide | null,
    committed: readonly GameSide[]
  ) => string | null;
  /** The finished game in `position`, which `winner` won. */
  readonly result: (position: string, winner: GameWinner) => GameResultSummary;
};

/** First place first; seats sharing a place keep their seat order. */
function byPlace(standings: readonly GameStanding[]): readonly GameStanding[] {
  return [...standings].sort((a, b) => a.place - b.place);
}

const NO_ACTIONS: readonly GameFrameAction[] = Object.freeze([]);

/** A board that offers no actions or controls of its own. */
export function boardOnly<View>(
  Board: (props: GameBoardProps) => View
): (props: GameFrameBoardProps) => GameFrameBoardSession<View> {
  return (props) => ({ Board: () => Board(props), actions: () => NO_ACTIONS });
}

const NO_FACTS: readonly string[] = Object.freeze([]);

/** Seats told apart by `look` alone: no figure, no facts, never out. */
export function lookOnlySeats(
  look: (side: GameSide) => GameSeatLook
): GameFrame<unknown>['seats'] {
  return { look, stat: () => null, facts: () => NO_FACTS, out: () => false };
}

/** A game that always seats `count`. */
export function fixedPlayers(count: FrameSeatCount): GamePlayers {
  return { min: count, max: count, default: count };
}

/**
 * The standings of a game without scores: every winner first (every seat
 * for a draw), everyone else sharing the next place.
 */
export function standingsFromWinner(
  winner: GameWinner,
  sides: readonly GameSide[]
): readonly GameStanding[] {
  const winners = winningSides(winner, sides);
  return byPlace(
    sides.map((side) => ({
      side,
      place: winners.includes(side) ? 1 : winners.length + 1,
      score: null,
    }))
  );
}

/**
 * The standings of a game ranked by score: every winner first (every seat
 * for a draw, whatever its score), then everyone else by `score`, `best`
 * first, equal scores sharing a place.
 */
export function standingsByScore(args: {
  readonly winner: GameWinner;
  readonly sides: readonly GameSide[];
  readonly score: (side: GameSide) => number;
  readonly best: 'highest' | 'lowest';
}): readonly GameStanding[] {
  const winners = winningSides(args.winner, args.sides);
  const better = (a: number, b: number) =>
    args.best === 'highest' ? a > b : a < b;
  const rest = args.sides.filter((side) => !winners.includes(side));
  return byPlace(
    args.sides.map((side) => {
      const score = args.score(side);
      const place = winners.includes(side)
        ? 1
        : winners.length +
          1 +
          rest.filter((other) => better(args.score(other), score)).length;
      return { side, place, score: String(score) };
    })
  );
}
