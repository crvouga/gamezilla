import { defaultBoardTheme } from '@pkgs/chess-board-root-shared-ts/board-theme';
import type { BoardWorld } from './board-world';
import { readOptions } from './options-reads';
import {
  identifyPreparedPosition,
  PREPARED_OPTIONS,
} from './prepared-positions';

function identifyColors(dark: string, light: string): string {
  const theme = defaultBoardTheme();
  if (dark === theme.darkSquare && light === theme.lightSquare)
    return 'default';
  if (dark === 'green' && light === '#f0d9b5') return 'green and cream';
  if (dark === '#b58863' && light === '#f0d9b5') return 'brown and cream';
  return 'unrecognized ' + dark + '/' + light;
}

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
      colors: identifyColors(view.dark, view.light),
    },
  };
};
