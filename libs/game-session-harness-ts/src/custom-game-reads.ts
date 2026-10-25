/**
 * What a person sees of a custom game beyond its state: an invitation
 * offered to them, which side sits nearest them at the board, whether its
 * creator is offered the start, that it is unrated, its move list, and the
 * offer to claim the win.
 */

import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { CUSTOM_GAME_SIDES } from '@libs/game-session-shared-ts/custom-game-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

/** Whether the person is shown their invitation to play `side`. */
export async function customGameInvitationShown(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`custom-game-${side}-invitation`).isVisible();
}

/** What the person's invitation to play `side` says, or `null` with none. */
export async function readCustomGameInvitation(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const invitation = ui.get(`custom-game-${side}-invitation`);
  return (await invitation.isVisible()) ? await invitation.text() : null;
}

/**
 * The side whose seat sits below the board, nearest the person holding the
 * device, or `null` while the seats are not around the board (before start).
 */
export async function customGameNearestSide(
  s: ProductHarness,
  actor: string
): Promise<CustomGameSide | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const near = ui.get('custom-game-seat-near');
  for (const side of CUSTOM_GAME_SIDES)
    if (await near.get(`custom-game-${side}`).isVisible()) return side;
  return null;
}

/** Whether the person is offered a start they can press now. */
export async function customGameStartOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const start = ui.get('custom-game-start');
  if (!(await start.isVisible())) return false;
  return (
    (await start.attribute('disabled')) === null &&
    (await start.attribute('aria-disabled')) !== 'true'
  );
}

/** Whether the person is shown that the custom game is unrated. */
export async function customGameShownUnrated(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get('custom-game-unrated').isVisible();
}

/** At most as many moves as the board lists after its earlier ones. */
const LISTED_MOVES_STRIDE = 40;

/**
 * The moves the person's move list shows, in order, as the game writes them:
 * a long game's latest moves only.
 */
export async function readCustomGameMoveList(
  s: ProductHarness,
  actor: string
): Promise<readonly string[]> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const listed = (ply: number) =>
    ui.get(`custom-game-review-move-${String(ply)}`);
  // A long game lists only its latest moves, a run shorter than the stride:
  // stepping by it lands on one of them.
  let first = 1;
  if (await ui.get('custom-game-earlier-moves').isVisible()) {
    while (!(await listed(first).isVisible())) first += LISTED_MOVES_STRIDE;
    while (first > 1 && (await listed(first - 1).isVisible())) first -= 1;
  }
  const shown: string[] = [];
  for (let ply = first; ; ply += 1) {
    const move = listed(ply);
    if (!(await move.isVisible())) return shown;
    shown.push((await move.text()) ?? '');
  }
}

/** Whether the person is offered to claim the win from someone away. */
export async function customGameClaimWinOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get('custom-game-claim-win').isVisible();
}

/** Everything the custom-game screen says, or `null` when it is not shown. */
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
 * What the custom-game screen tells the person after a refused choice: the
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

/** What the seat of `side` calls whoever holds it, on the person's screen. */
export async function customGameSeatName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`custom-game-${side}-person`).text();
}
