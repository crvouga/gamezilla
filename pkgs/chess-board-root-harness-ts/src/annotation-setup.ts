import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  ACTIVITY_ARROWS,
  ACTIVITY_SQUARES,
  drawArrow,
  startArrow,
} from './annotation-actions';
import type { BoardWorld } from './board-world';

export const prepareAnnotations = defineAction({
  name: 'prepareAnnotations',
  act(
    w: BoardWorld,
    input: {
      personal?: 'arrow' | 'circle' | 'both';
      circle?: Square;
      activity?: boolean;
      drawing?: boolean;
      enabled?: boolean;
    } = {}
  ) {
    w.app.reset({
      enableUserArrows: input.enabled ?? true,
      ...(input.activity
        ? { arrows: ACTIVITY_ARROWS, ...ACTIVITY_SQUARES }
        : {}),
    });
    if (input.personal === 'arrow' || input.personal === 'both')
      drawArrow(w, 'e2', 'e4');
    if (input.personal === 'circle' || input.personal === 'both')
      drawArrow(w, input.circle ?? 'd5', input.circle ?? 'd5');
    if (input.drawing) startArrow(w, 'e2', 'e4');
    w.app.clearEvidence();
  },
});
export const annotationSetupActions = [prepareAnnotations];
