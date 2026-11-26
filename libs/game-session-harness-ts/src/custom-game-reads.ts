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

/** Opens the move list and the history from the status line of a game played. */
export const CUSTOM_GAME_ASIDE = 'custom-game-commands';

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
 * The side the board is drawn nearest the person holding the device, or
 * `null` while no game is played on it (before start).
 */
export async function customGameNearestSide(
  s: ProductHarness,
  actor: string
): Promise<CustomGameSide | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const board = ui.get('custom-game-public');
  if (!(await board.isVisible())) return null;
  const near = await board.attribute('data-near');
  return CUSTOM_GAME_SIDES.find((side) => side === near) ?? null;
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

/** The moves played so far, as the board stage tells observers. */
async function playedPly(ui: Awaited<ReturnType<typeof actorUi>>) {
  const raw = await ui.get('custom-game-public').attribute('data-ply');
  const ply = Number(raw ?? '0');
  return Number.isInteger(ply) ? ply : 0;
}

/** The moves listed now, in order, from the first one shown. */
async function listedMoves(
  ui: Awaited<ReturnType<typeof actorUi>>
): Promise<readonly string[]> {
  const listed = (ply: number) =>
    ui.get(`custom-game-review-move-${String(ply)}`);
  // The list shows one run of moves, not always from the first: find where
  // it starts among the moves played.
  const played = await playedPly(ui);
  let first = 1;
  while (first < played && !(await listed(first).isVisible())) first += 1;
  const shown: string[] = [];
  for (let ply = first; ; ply += 1) {
    const move = listed(ply);
    if (!(await move.isVisible())) return shown;
    shown.push((await move.text()) ?? '');
  }
}

/**
 * The moves the person's move list shows, in order, as the game writes
 * them (a long game's latest moves). While the game is played the list
 * opens from the status line, as a person opens it, and closes after.
 */
export async function readCustomGameMoveList(
  s: ProductHarness,
  actor: string
): Promise<readonly string[]> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const opener = ui.get(CUSTOM_GAME_ASIDE);
  const opens =
    !(await ui.get('custom-game-record').isVisible()) &&
    (await opener.isVisible());
  if (opens) {
    await opener.tap();
    await s.session.waitForIdle();
  }
  try {
    return await listedMoves(ui);
  } finally {
    if (opens) {
      await ui.key('escape');
      await s.session.waitForIdle();
    }
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

/**
 * What the seat of `side` calls whoever holds it, on the person's screen:
 * while the game is set up its seat names them; once it is played their
 * cell in the space's people row does, its accessible name opening with
 * the name (`You` for the person themselves).
 */
export async function customGameSeatName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const seat = ui.get(`custom-game-${side}-person`);
  if (!(await seat.isVisible())) return seat.text();
  const label = await seat.attribute('aria-label');
  return label === null ? seat.text() : (label.split(', ')[0] ?? null);
}
