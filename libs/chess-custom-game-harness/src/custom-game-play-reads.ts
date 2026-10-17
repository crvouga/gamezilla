/**
 * The Custom Game board as a person sees it painted: how it faces and a
 * waiting promotion.
 */

import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type { ChessBoardProbe } from '@pkgs/chess-board-core-shared/probe';

export const CUSTOM_GAME_BOARD = 'custom-game-board';

/** The Custom Game board as painted, or `null` when none is on screen. */
export async function readCustomGameBoardProbe(
  s: ProductHarness,
  actor: string
): Promise<ChessBoardProbe | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (!(await ui.get(CUSTOM_GAME_BOARD).isVisible())) return null;
  return new ChessBoardFlows(ui, CUSTOM_GAME_BOARD).readProbe();
}
