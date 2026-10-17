/**
 * What a person sees of an active Custom Game beyond the debug probe: the
 * board as painted (how it faces, a waiting promotion), the notice that the
 * other participant is away, and the words on the screen.
 */

import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
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

/** Whether the person is told the other participant is away. */
export async function customGameAwayShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get('custom-game-away').isVisible();
}

/** Whether the person is offered the action to claim the game for absence. */
export async function customGameAwayClaimShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  return (await actorUi(s, actor)).get('custom-game-claim-win').isVisible();
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
  const content = ui.get('custom-game-content');
  return (await content.isVisible()) ? await content.text() : null;
}

/**
 * What the Custom Game screen tells the person after a refused choice: the
 * alert's words, `''` with none, or `null` when the screen is not shown.
 */
export async function readCustomGameAlert(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (!(await ui.get('custom-game-content').isVisible())) return null;
  const alert = ui.get('custom-game-error');
  return (await alert.isVisible()) ? ((await alert.text()) ?? '') : '';
}
