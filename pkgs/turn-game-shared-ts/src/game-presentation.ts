import type { GameFrame } from './game-frame';
import type { GameSide } from './game-rules';
export type GameSimulationControls = {
  readonly paused: boolean;
  readonly stale: boolean;
  readonly sides: readonly GameSide[];
  /** This person's sides that another of their devices steers now. */
  readonly elsewhere?: readonly GameSide[];
  /** Steer those sides from this device instead, where the game allows it. */
  readonly claim?: () => void;
  readonly onInput: (side: GameSide, input: unknown) => void;
  readonly onRelease: () => void;
};
export type GameBoardProps = {
  readonly simulation?: GameSimulationControls | undefined;
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
  /**
   * The viewer's own hand, for a game whose authority deals hands; `null`
   * for a watcher and for every other game. A board never receives another
   * side's hand.
   */
  readonly hand: string | null;
  /**
   * In a game with private commitments: the sides that have committed in the
   * phase open now (everyone sees which, never what), and the viewer's own
   * commitment, `null` until they make one. Empty and `null` otherwise.
   */
  readonly committed: readonly GameSide[];
  readonly commitment: string | null;
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
  /** What the shared frame around the board shows of the game, as data. */
  readonly frame: GameFrame<View>;
  readonly endingDescription: (reason: string) => string | undefined;
  readonly timeoutDrawDescription?: (flagged: GameSide) => string;
  readonly endingLabel: (reason: string) => string;
  /**
   * What a person is told when the game's own rules refuse their choice
   * (`must follow suit`), for a refusal reason the game itself gave; absent
   * or `undefined` for a reason only the platform words.
   */
  readonly refusalDescription?: (reason: string) => string | undefined;
};
