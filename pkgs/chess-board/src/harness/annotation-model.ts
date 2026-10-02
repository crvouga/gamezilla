import { defineAction } from '@pkgs/harness';
import { readAnnotations } from './annotation-reads';
import type { BoardWorld } from './board-world';
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
  const activityArrows = view.arrows
    .filter(
      (a) =>
        a.token.startsWith('arrow:green@') || a.token.startsWith('arrow:blue@')
    )
    .map(
      (a) =>
        (a.color ?? 'unrecognized') +
        ' ' +
        (a.dashed ? 'dashed' : 'solid') +
        ' ' +
        endpoints(a.token)
    );
  const activitySquares = view.highlights.map((h) =>
    h.token.includes(':ring')
      ? (h.ring.split(' ').at(-1) ?? 'unrecognized') +
        ' ring ' +
        (h.token.split('@')[1] ?? 'unrecognized')
      : h.color + ' fill ' + (h.token.split('@')[1] ?? 'unrecognized')
  );
  for (const badge of view.badges)
    activitySquares.push(
      (badge.name.length > 0
        ? badge.name
        : (badge.accessibleName ?? 'unnamed')) +
        ' badge ' +
        (badge.token?.split('@')[1] ?? 'unrecognized')
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
