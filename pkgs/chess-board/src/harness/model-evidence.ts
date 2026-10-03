import { readAnnotations } from './annotation-reads';
import type { BoardWorld } from './board-world';
import { readOptions } from './options-reads';
import { readPromotionAccess } from './promotion-access';

/** A replay compares the complete observed board, beyond its model projection. */
export const readModelEvidence = (w: BoardWorld) => {
  const shared = {
    closed: w.app.closed(),
    moveCallbacks: w.app.moveDetails(),
    sounds: w.app.audio.played(),
    earlierCompletion: w.app.motion.hasEarlierCompletion(),
    arrivals: w.app.motion.activePieces(),
    keyboardInput: w.app.keyboardInput(),
  };
  if (shared.closed)
    return {
      ...shared,
      markup: w.app.host.isConnected ? w.app.host.innerHTML : null,
      attached: w.app.root.isConnected,
      active: w.app.motion.active(),
    };
  return {
    ...shared,
    probe: w.app.probe(),
    paint: w.app.view(),
    options: readOptions(w),
    annotations: readAnnotations(w),
    promotion: readPromotionAccess(w),
    announcement: w.app.spoken(),
  };
};

export const readModelFingerprint = (w: BoardWorld) =>
  JSON.stringify(readModelEvidence(w));
