import type { GameRules } from './game-rules';

/** A game's ordinary controls and legal decisions, independent of the UI driver. */
export type GameAutomation<Ui> = {
  readonly rules: GameRules;
  readonly selectControl: string;
  readonly multiplayerControl: string;
  readonly boardControl: string;
  readonly choose: (position: string, random: () => number) => string | null;
  readonly perform: (ui: Ui, action: string) => Promise<void>;
};
