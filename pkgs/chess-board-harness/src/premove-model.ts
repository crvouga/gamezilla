import type { BoardWorld } from './board-world';
import { REPLACEMENT } from './positions';
import { identifyPreparedPremove } from './prepared-premoves';
export const readPremoveModel = (w: BoardWorld) => {
  const probe = w.app.probe();
  const replacement = probe.fen === REPLACEMENT;
  const position = replacement
    ? { replies: 0, movedPieces: [], pawnCaptured: false }
    : identifyPreparedPremove(probe.fen);
  return {
    premoveBoard: {
      position: { ...position, movedPieces: new Set(position.movedPieces) },
      waiting: probe.turn === 'b',
      enabled: w.app.config().premoves === true,
      queued: probe.premoves.map((p) => p.from + ' to ' + p.to),
      selectedSource: probe.selected ?? 'none',
      offers: w.app.moveDetails().map((p) => p.from + ' to ' + p.to),
      replacement,
    },
  };
};
