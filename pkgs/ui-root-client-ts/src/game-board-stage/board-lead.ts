import { createContext, useContext } from 'solid-js';

/**
 * How far a `GameBoardStage`'s board sits below the top of its stage (the
 * seat drawn above it), in whole CSS px. `GameLayout` provides it so the
 * rail beside a wide board starts level with the board's top edge rather
 * than with the seat above it. Outside a `GameLayout` nobody listens.
 */
export const GameBoardLeadContext = createContext<(px: number) => void>(
  () => undefined
);

/** Report the board's lead to the `GameLayout` around it, if any. */
export function useGameBoardLead(): (px: number) => void {
  return useContext(GameBoardLeadContext);
}
