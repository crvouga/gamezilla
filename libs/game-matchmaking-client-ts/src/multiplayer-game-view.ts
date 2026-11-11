/** One accepted move as the move list shows it. */
export type MultiplayerMoveShown = {
  /** Moves played to reach the position after it: 1 for the first move. */
  readonly ply: number;
  /** The move in the game's notation: `Nf3`. */
  readonly san: string;
  /** Its round, where the list numbers it; empty otherwise. */
  readonly numbering: string;
  /** The move named by itself: `1. e4`, `1... e5`. */
  readonly name: string;
};

/** The moves of a game played in turns, and the position this device shows. */
export type MultiplayerMovesShown = {
  readonly moves: readonly MultiplayerMoveShown[];
  /** Moves played to reach the shown position. */
  readonly shownPly: number;
  /**
   * The earlier position under review, named by the move it follows
   * (`null` at the start of the game); `null` on the current position.
   */
  readonly reviewing: { readonly after: string | null } | null;
};

/** What a game that is over with a result offers to keep. */
export type MultiplayerRecordView = {
  /** The whole game, in the game's notation. */
  readonly record: string;
  readonly finalPosition: string;
};

/**
 * Where an offer stands for this person: nothing to do with it, they may
 * make it, or one made to them waits for their answer.
 */
export type MultiplayerOffer = 'none' | 'offer' | 'answer';

/** The command waiting for the person to confirm. */
export type MultiplayerConfirm = 'resign' | 'abort';

/** The matched game as this person may act on it: only what its state allows. */
export type MultiplayerGameView = {
  /** How many people it seats. */
  readonly players: number;
  /** Leaving an unfinished game: aborting before play begins, resigning after. */
  readonly leave: MultiplayerConfirm | null;
  readonly draw: MultiplayerOffer;
  readonly rematch: MultiplayerOffer;
  /** The person may seek a new opponent: the game is over and they played it. */
  readonly newOpponent: boolean;
  /** The board can be turned around; `null` for a board with one view. */
  readonly flip: { readonly flipped: boolean } | null;
  /** `null` for a game without turns. */
  readonly moves: MultiplayerMovesShown | null;
  /** `null` while unfinished, and for an aborted game. */
  readonly record: MultiplayerRecordView | null;
};

/** What the person does with their matched game. */
export type MultiplayerGameCommands = {
  readonly offerDraw: () => Promise<void>;
  readonly acceptDraw: () => Promise<void>;
  readonly declineDraw: () => Promise<void>;
  readonly offerRematch: () => Promise<void>;
  readonly acceptRematch: () => Promise<void>;
  readonly declineRematch: () => Promise<void>;
  readonly newOpponent: () => Promise<void>;
  /** Asks the person to confirm resigning or aborting. */
  readonly ask: (kind: MultiplayerConfirm) => void;
  /** Turns this device's board around. */
  readonly flip: () => void;
  /** Shows the position after `ply` moves on this device's board. */
  readonly chooseMove: (ply: number) => void;
  readonly stepBack: () => void;
  readonly stepForward: () => void;
  readonly goToStart: () => void;
  readonly returnToCurrent: () => void;
  readonly copy: (text: string) => Promise<void>;
};
