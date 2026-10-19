import type { GameRules } from './game-rules';

/**
 * A game's legal decisions and its board gesture, independent of the UI
 * driver. Where the game is chosen and which board it is played on are the
 * platform's controls; the game only says how one action is performed there.
 */
export type GameAutomation<Ui> = {
  readonly rules: GameRules;
  readonly choose: (position: string, random: () => number) => string | null;
  /** Perform `action` on the game's board identified by `board`. */
  readonly perform: (ui: Ui, board: string, action: string) => Promise<void>;
};
