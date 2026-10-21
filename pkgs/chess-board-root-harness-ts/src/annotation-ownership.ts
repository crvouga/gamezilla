import type { BoardArrow } from '@pkgs/chess-board-core-shared-ts/types';
import type { readAnnotationDom } from './annotation-dom';

/** Partition actual paint using the board's actual latest personal-arrow callback. */
export function partitionArrows(
  arrows: ReturnType<typeof readAnnotationDom>['arrows'],
  reported: readonly BoardArrow[]
) {
  const remaining = reported.map(
    (a) => `arrow:${a.color ?? 'primary'}@${a.from}-${a.to}`
  );
  const personal: typeof arrows = [];
  const activity: typeof arrows = [];
  for (const arrow of arrows) {
    const index = remaining.indexOf(arrow.token);
    if (index >= 0) {
      personal.push(arrow);
      remaining.splice(index, 1);
    } else if (!arrow.token.startsWith('arrow-preview:')) activity.push(arrow);
  }
  return { personal, activity };
}
