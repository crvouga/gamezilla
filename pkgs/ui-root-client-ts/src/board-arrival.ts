import { type Accessor, createMemo } from 'solid-js';

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
