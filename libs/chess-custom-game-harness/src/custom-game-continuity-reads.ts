import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Chess } from 'chess.js';
import { readCustomGameProbe } from './custom-game-ui';

/** The first White bot move is legal from the starting board. */
export async function legalWhiteBotMoveShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const game = (await readCustomGameProbe(s, actor))?.current;
  const move = game?.moves[0];
  if (game?.white.kind !== 'bot' || move === undefined) return false;
  const legal = new Chess().moves({ verbose: true });
  return legal.some(
    (candidate) =>
      candidate.from + candidate.to + (candidate.promotion ?? '') === move.uci
  );
}

export async function customGameUnratedShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return (await ui.get('chess-custom-unrated').text()) === 'Unrated';
}
