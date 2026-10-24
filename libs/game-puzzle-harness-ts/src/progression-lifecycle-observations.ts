import { currentAttemptView } from './attempt-observations';
import type { ContentHarness } from './content-system';
import {
  currentPackProgress,
  namedPackProgress,
} from './pack-progress-observations';

export async function progressionLifecycleState(s: ContentHarness) {
  const phone = await currentPackProgress(s, 'bob:phone');
  const tablet = await namedPackProgress(s, 'bob:tablet', 'Rivers');
  if (phone === null) throw new Error('The opened pack is unavailable');
  const selected = await currentAttemptView(s, 'bob:phone');
  const status = (value: string) =>
    value === 'in-progress' ? 'in progress' : value;
  return {
    started: new Set(
      phone.items
        .filter((item) => item.status !== 'unplayed')
        .map((item) => s.lifecyclePuzzles.indexOf(item.puzzleId))
    ),
    completed: new Set(
      phone.items
        .filter((item) => item.status === 'completed')
        .map((item) => s.lifecyclePuzzles.indexOf(item.puzzleId))
    ),
    activePuzzle: phone.items.findIndex(
      (item) => item.revisionId === selected?.editionId
    ),
    offeredPuzzle: s.lifecyclePuzzles.indexOf(phone.next?.puzzleId ?? ''),
    progress: new Map(
      phone.items.map((item, index) => [index, status(item.status)])
    ),
    otherProgress: new Map(
      tablet?.items.map((item, index) => [index, status(item.status)]) ?? []
    ),
    completionCount: phone.completedCount,
    packComplete: phone.complete,
  };
}
