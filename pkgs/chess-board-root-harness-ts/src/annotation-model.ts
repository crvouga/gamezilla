import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { readActivityArrowAppearances } from './annotation-appearance';
import { readAnnotations } from './annotation-reads';
import type { BoardWorld } from './board-world';
import { readFeedbackAppearance } from './feedback-dom';
import { INITIAL, REPLACEMENT } from './positions';
import { identifyPreparedPosition } from './prepared-positions';
export const beginArrowObservation = defineAction({
  name: 'beginArrowObservation',
  act: (w: BoardWorld) => w.app.beginArrowObservation(),
});
export const readAnnotationModel = (w: BoardWorld) => {
  const view = readAnnotations(w);
  const endpoints = (token: string) =>
    token.split('@')[1]?.replace('-', ' to ') ?? 'unrecognized';
  const activityArrows = readActivityArrowAppearances(w).map(
    (a) => `${a.color} ${a.line} ${a.endpoints}`
  );
  const activitySquares = view.highlights.map((h) =>
    h.token.includes(':ring')
      ? (h.ring.split(' ').at(-1) ?? 'unrecognized') +
        ' ring ' +
        (h.token.split('@')[1] ?? 'unrecognized')
      : h.color + ' fill ' + (h.token.split('@')[1] ?? 'unrecognized')
  );
  for (const badge of readFeedbackAppearance(w))
    activitySquares.push(
      ['tick', 'cross', 'exclamations'].includes(badge.symbol)
        ? `${badge.color} ${badge.symbol} ${badge.placement} ${badge.square}`
        : `${badge.symbol} badge ${badge.square}`
    );
  const arrows = view.changes.at(-1) ?? [];
  return {
    annotationBoard: {
      position: identifyPreparedPosition(w.app.probe().fen, {
        opening: INITIAL,
        replacement: REPLACEMENT,
      }),
      orientation: w.app.probe().orientation === 'white' ? 'White' : 'Black',
      enabled: view.enabled,
      personalArrows: new Set(view.personalArrows.map(endpoints)),
      personalCircles: new Set(
        view.circles.map((token) => token.split('@')[1] ?? 'unrecognized')
      ),
      pendingArrow:
        view.unfinished[0] === undefined
          ? 'none'
          : endpoints(view.unfinished[0]),
      activityArrows: new Set(activityArrows),
      activitySquares: new Set(activitySquares),
      offeredArrows: new Set(arrows.map((a) => a.from + ' to ' + a.to)),
      arrowOffers: w.app.arrowOffers(),
    },
  };
};
