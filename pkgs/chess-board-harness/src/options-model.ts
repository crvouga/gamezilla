import type { BoardWorld } from './board-world';
import { readOptions } from './options-reads';
import {
  identifyPreparedPosition,
  PREPARED_OPTIONS,
} from './prepared-positions';
export const readOptionsModel = (w: BoardWorld) => {
  const view = readOptions(w);
  const probe = w.app.probe();
  const supported = view.width >= 196 && view.width <= 16384;
  const fixed = view.suppliedWidth !== undefined;
  const broad = view.width >= 196 && view.width <= 16384;
  const legalPaint = view.marks.some(
    (t) => t.startsWith('dot@') || t.startsWith('ring@')
  );
  const lastMovePaint = view.marks.some((t) => t.startsWith('last-move@'));
  return {
    optionsBoard: {
      position: identifyPreparedPosition(probe.fen, PREPARED_OPTIONS),
      selected: probe.selected !== null,
      held: w.app.view().holding,
      pendingPromotion: w.app.promotionChoices().length > 0,
      interactive: view.config.interactive !== false,
      roomToMove: supported,
      availableSpace: view.availableWidth >= 196 ? 'broad' : 'narrow',
      fixedWidth: fixed,
      chosenSpace:
        view.suppliedWidth !== undefined
          ? view.suppliedWidth >= 196
            ? 'broad'
            : 'narrow'
          : 'none',
      width: fixed
        ? broad
          ? 'chosen broad'
          : 'chosen narrow'
        : broad
          ? 'broad'
          : 'narrow',
      coordinates: view.coordinates.length > 0,
      legalMarks:
        probe.legalTargets.length > 0
          ? legalPaint
          : view.config.highlightLegalMoves !== false,
      lastMoveMarks:
        probe.lastMove !== null
          ? lastMovePaint
          : view.config.highlightLastMove !== false,
      colors:
        view.dark === 'green' && view.light === '#f0d9b5'
          ? 'green and cream'
          : view.dark === '#b58863' && view.light === '#f0d9b5'
            ? 'brown and cream'
            : 'unrecognized ' + view.dark + '/' + view.light,
    },
  };
};
