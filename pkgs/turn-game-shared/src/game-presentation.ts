import type { GameSide } from './game-rules';
export type GameBoardProps = {
  readonly position: string;
  readonly orientation: GameSide;
  readonly interactive: boolean;
  readonly sound: boolean;
  readonly syncKey: number;
  readonly onAction: (action: string) => void;
  readonly testId: string;
};
export type GamePresentation<View = unknown> = {
  readonly name: () => string;
  readonly canFlip: boolean;
  readonly id: string;
  readonly Board: (props: GameBoardProps) => View;
  readonly sideLabel: (side: GameSide) => string;
  readonly endingDescription: (reason: string) => string | undefined;
  readonly timeoutDrawDescription: (flagged: GameSide) => string;
  readonly endingLabel: (reason: string) => string;
};
