import type { TurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import { parseProposal } from './word-tiles-action';
import { cellName } from './word-tiles-board';
import { wordTilesBots } from './word-tiles-rules';

/**
 * How a synthetic person plays a proposal on the Word Tiles board, with the
 * same controls a person uses: tap a rack tile, (for a blank) its letter,
 * then a cell, for each tile, then submit; or pass; or choose the tiles to
 * exchange and confirm.
 */
export const wordTilesAutomation: TurnGame['automation'] = {
  choose: (position, random, hand) =>
    wordTilesBots.choose(position, 'medium', random, hand),
  async perform(ui, board, action) {
    const proposal = parseProposal(action);
    if (proposal === null)
      throw new Error(`not a Word Tiles proposal: ${action}`);
    const tap = async (id: string) => {
      const control = ui.get(`${board}-${id}`);
      await control.wait('enabled');
      await control.tap();
    };
    if (proposal.kind === 'pass') return tap('pass');
    if (proposal.kind === 'exchange') {
      await tap('exchange');
      for (const tile of proposal.tiles) await tap(`rack-${tile}`);
      return tap('exchange-confirm');
    }
    for (const placed of proposal.tiles) {
      await tap(`rack-${placed.tile}`);
      await tap(`cell-${cellName(placed.cell)}`);
      if (placed.assigned !== null) await tap(`blank-${placed.assigned}`);
    }
    return tap('submit');
  },
};
