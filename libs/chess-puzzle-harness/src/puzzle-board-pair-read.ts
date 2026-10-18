import { readPuzzleBoardPosition } from '@libs/game-session-harness/puzzle-screen';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';

/** Both currently displayed positions, including an opponent's automatic reply. */
export async function puzzleBoardPair(
  s: ProductHarness,
  first: string,
  second: string
): Promise<{ readonly first: string | null; readonly second: string | null }> {
  await bringToFront(s, first);
  const firstFen = await readPuzzleBoardPosition(s, first);
  await bringToFront(s, second);
  const secondFen = await readPuzzleBoardPosition(s, second);
  return { first: firstFen, second: secondFen };
}
