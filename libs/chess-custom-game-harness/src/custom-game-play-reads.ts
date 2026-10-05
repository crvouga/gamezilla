/**
 * What a person sees of an active Custom Game beyond the debug probe: the
 * board as painted (how it faces, a waiting promotion), an invitation offered
 * to them, the notice that the other participant is away, and the words on
 * the screen.
 */

import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { ChessBoardFlows } from '@pkgs/chess-board-core-shared/flows';
import type { ChessBoardProbe } from '@pkgs/chess-board-core-shared/probe';
import { readCustomGameProbe } from './custom-game-ui';

export const CUSTOM_GAME_BOARD = 'chess-custom-board';

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

/** Whether the person is shown their invitation to play `side`. */
export async function customGameInvitationShown(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`chess-custom-${side}-invitation`).isVisible();
}

/** Whether the person is told the other participant is away. */
export async function customGameAwayShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get('chess-custom-away').isVisible();
}

/** Since when `person` has been away as `observer`'s game shows it, or `null`. */
export async function readCustomGameAwaySince(
  s: ProductHarness,
  observer: string,
  person: string
): Promise<number | null> {
  return (await readCustomGameProbe(s, observer))?.away[person] ?? null;
}

/** Everything the Custom Game screen says, or `null` when it is not shown. */
export async function readCustomGameScreenText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const content = ui.get('chess-custom-content');
  return (await content.isVisible()) ? await content.text() : null;
}
