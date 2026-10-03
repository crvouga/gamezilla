import { readPuzzleBoardSounds } from '@libs/chess/harness/chess-board-audio';
import type { Actor, HarnessWorld } from '@libs/harness/spec/define';
import { recall, remember } from '@libs/harness/spec/world';

const key = (actor: Actor) => 'puzzle-audio-start:' + actor;
export async function markPuzzleSoundBoundary(w: HarnessWorld, actor: Actor) {
  remember(
    w,
    key(actor),
    (await w.s.read(readPuzzleBoardSounds, actor)).length
  );
}
export async function recentPuzzleSounds(w: HarnessWorld, actor: Actor) {
  const start = recall(w, key(actor));
  if (typeof start !== 'number')
    throw new Error('No actual audio boundary recorded');
  await w.s.advanceTime(1000);
  return (await w.s.read(readPuzzleBoardSounds, actor)).slice(start);
}
