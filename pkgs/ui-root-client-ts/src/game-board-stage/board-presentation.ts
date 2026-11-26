import { type Accessor, createContext, createMemo, useContext } from 'solid-js';

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

/** Motion starts when a piece appears on a board the player can already see. */
export function createBoardArrival(
  present: Accessor<boolean>
): Accessor<boolean> {
  const phase = createMemo<'empty' | 'present' | 'arrived'>((previous) => {
    if (!present()) return 'empty';
    return previous === 'empty' ? 'arrived' : (previous ?? 'present');
  });
  return () => phase() === 'arrived';
}
