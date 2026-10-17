/**
 * What a person sees of a custom game beyond its state: an invitation
 * offered to them, which side sits nearest them at the board, whether its
 * creator is offered the start, that it is unrated, and its move list.
 */

import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { CUSTOM_GAME_SIDES } from '@libs/game-session-shared/custom-game-state';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';

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

/** The moves the person's move list shows, in order, as the game writes them. */
export async function readCustomGameMoveList(
  s: ProductHarness,
  actor: string
): Promise<readonly string[]> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const shown: string[] = [];
  for (let ply = 1; ; ply += 1) {
    const move = ui.get(`custom-game-review-move-${String(ply)}`);
    if (!(await move.isVisible())) return shown;
    shown.push((await move.text()) ?? '');
  }
}
