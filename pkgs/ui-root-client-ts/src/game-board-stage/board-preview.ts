import { type Accessor, createContext, useContext } from 'solid-js';

/**
 * Whether the board is drawn as a `GameBoardStage` preview (a game still
 * being set up): a board that has turn chrome of its own (a prompt line,
 * column numbers, drop marks) leaves it out there, since nobody is to move.
 */
export const GameBoardPreviewContext = createContext<Accessor<boolean>>(
  () => false
);

/** True inside a `GameBoardStage` drawn as a preview. */
export function useGameBoardPreview(): Accessor<boolean> {
  return useContext(GameBoardPreviewContext);
}
