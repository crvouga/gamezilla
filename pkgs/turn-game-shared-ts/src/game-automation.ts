import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import type { GamePositionRules, GameRules, GameSide } from './game-rules';

/**
 * A game's legal decisions and its board gesture, independent of the UI
 * driver. Where the game is chosen and which board it is played on are the
 * platform's controls; the game only says how one action is performed there.
 */
export type TurnAutomation<Ui> = {
  readonly rules: GameRules;
  /** `hand` is the side's own dealt hand, for a game with dealt hands; `null` otherwise. */
  readonly choose: (
    position: string,
    random: () => number,
    hand: string | null
  ) => string | null;
  /** Perform `action` on the game's board identified by `board`. */
  readonly perform: (ui: Ui, board: string, action: string) => Promise<void>;
  /**
   * Exactly for a game with private setups: arrange `setup` on the game's
   * setup board identified by `board`, as a person would.
   */
  readonly arrange?: (ui: Ui, board: string, setup: string) => Promise<void>;
};

/** Continuous intent uses the same controls as a person; no move list or acknowledgement. */
export type ContinuousAutomation<Ui> = {
  readonly intervalMs: number;
  readonly choose: (
    position: string,
    side: GameSide,
    context: { readonly elapsedMs: number; readonly random: Random }
  ) => unknown | null;
  readonly parseInput: (value: unknown) => unknown | null;
  readonly perform: (
    ui: Ui,
    board: string,
    side: GameSide,
    input: unknown
  ) => Promise<void>;
};

/** Independently optional decision capabilities, including games that combine both. */
export type GameAutomation<Ui> = {
  readonly rules: GamePositionRules;
  readonly turns?: TurnAutomation<Ui>;
  readonly continuous?: ContinuousAutomation<Ui>;
};
