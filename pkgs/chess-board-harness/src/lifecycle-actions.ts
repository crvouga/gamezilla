import { defineAction } from '@pkgs/harness-shared/define-action';
import type { BoardWorld } from './board-world';

export const finishEarlierAnimation = defineAction({
  name: 'finishEarlierAnimation',
  act: (w: BoardWorld) => {
    w.app.motion.finishEarlier();
  },
});
/** Availability comes from an actual cancelled native animation registration. */
export const readEarlierCompletion = (w: BoardWorld) =>
  w.app.motion.hasEarlierCompletion();
export const readCurrentArrivals = (w: BoardWorld) =>
  w.app.motion.activePieces();

export const lifecycleActions = [finishEarlierAnimation];
