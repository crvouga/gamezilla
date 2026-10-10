import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { readPuzzleDisplayFen } from './chess-puzzle-ui';

/** Both currently displayed positions, including an opponent's automatic reply. */
export async function puzzleBoardPair(
  s: ProductHarness,
  first: string,
  second: string
): Promise<{ readonly first: string | null; readonly second: string | null }> {
  await bringToFront(s, first);
  const firstFen = await readPuzzleDisplayFen(s, first);
  await bringToFront(s, second);
  const secondFen = await readPuzzleDisplayFen(s, second);
  return { first: firstFen, second: secondFen };
}
