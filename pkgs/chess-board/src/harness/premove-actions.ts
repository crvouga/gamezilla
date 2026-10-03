import type { Square } from '@pkgs/chess-board-core/types';
import { defineAction } from '@pkgs/harness';
import { Chess } from 'chess.js';
import type { BoardWorld } from './board-world';

export const PREMOVE_READY = '4k1n1/4p3/8/8/8/8/3P3r/4K1N1 b - - 0 1';
export function pushReply(w: BoardWorld, from: Square, to: Square) {
  const oracle = new Chess(w.app.probe().fen);
  oracle.move({ from, to });
  w.app.configure({ fen: oracle.fen() });
}
export const supplyPremoveReply = defineAction({
  name: 'supplyPremoveReply',
  act: pushReply,
});
export const readPremoves = (w: BoardWorld) => ({
  queued: w.app.probe().premoves,
  previews: w.app
    .layer('pieces')
    .filter((t) => t.startsWith('premove-ghost:'))
    .map((token) => {
      const node = [
        ...w.app.host.querySelectorAll<HTMLElement>(
          '[data-testid="example-board-layer-pieces"] div'
        ),
      ].find((el) => el.textContent.includes('⟦' + token + '⟧'));
      return {
        token,
        opacity: node === undefined ? null : getComputedStyle(node).opacity,
      };
    }),
  enabled: w.app.config().premoves === true,
});
export const premoveActions = [supplyPremoveReply];
