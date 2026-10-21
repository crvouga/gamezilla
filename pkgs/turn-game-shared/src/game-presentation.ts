import type { GameSide } from './game-rules';
export type GameBoardProps = {
  readonly position: string;
  readonly orientation: GameSide;
  readonly interactive: boolean;
  readonly sound: boolean;
  readonly syncKey: number;
  readonly onAction: (action: string) => void;
  readonly testId: string;
  /**
   * The viewer's own private setup, for a game whose sides prepare one;
   * `null` for anyone else (a watcher) and for every other game. A board
   * never receives another side's setup.
   */
  readonly setup: string | null;
};
/** A side arranging its private setup: the game's own setup board. */
export type GameSetupBoardProps = {
  /** The arrangement so far, as the game writes it; `''` before anything is placed. */
  readonly setup: string;
  readonly side: GameSide;
  /** A ready or chosen setup cannot change. */
  readonly locked: boolean;
  readonly onChange: (setup: string) => void;
  readonly testId: string;
};
export type GamePresentation<View = unknown> = {
  readonly name: () => string;
  readonly canFlip: boolean;
  readonly id: string;
  readonly Board: (props: GameBoardProps) => View;
  /** Exactly for a game with private setups: where a side arranges its setup. */
  readonly SetupBoard?: (props: GameSetupBoardProps) => View;
  readonly sideLabel: (side: GameSide) => string;
  readonly endingDescription: (reason: string) => string | undefined;
  readonly timeoutDrawDescription: (flagged: GameSide) => string;
  readonly endingLabel: (reason: string) => string;
};
