/**
 * What a person sees of a game session beyond its state: an invitation
 * offered to them, which side sits nearest them at the board, whether its
 * creator is offered the start, that it is unrated, its move list, and the
 * offer to claim the win.
 */

import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { GAME_SESSION_SIDES } from '@libs/game-session-shared-ts/game-session-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

/** Whether the person is shown their invitation to play `side`. */
export async function gameSessionInvitationShown(
  s: ProductHarness,
  actor: string,
  side: GameSessionSide
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`game-session-${side}-invitation`).isVisible();
}

/** What the person's invitation to play `side` says, or `null` with none. */
export async function readGameSessionInvitation(
  s: ProductHarness,
  actor: string,
  side: GameSessionSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const invitation = ui.get(`game-session-${side}-invitation`);
  return (await invitation.isVisible()) ? await invitation.text() : null;
}

/**
 * The side whose seat sits below the board, nearest the person holding the
 * device, or `null` while the seats are not around the board (before start).
 */
export async function gameSessionNearestSide(
  s: ProductHarness,
  actor: string
): Promise<GameSessionSide | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const near = ui.get('game-session-seat-near');
  for (const side of GAME_SESSION_SIDES)
    if (await near.get(`game-session-${side}`).isVisible()) return side;
  return null;
}

/** Whether the person is offered a start they can press now. */
export async function gameSessionStartOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const start = ui.get('game-session-start');
  if (!(await start.isVisible())) return false;
  return (
    (await start.attribute('disabled')) === null &&
    (await start.attribute('aria-disabled')) !== 'true'
  );
}

/** Whether the person is shown that the game session is unrated. */
export async function gameSessionShownUnrated(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get('game-session-unrated').isVisible();
}

/** The moves played so far, as the board stage tells observers. */
async function playedPly(ui: Awaited<ReturnType<typeof actorUi>>) {
  const raw = await ui.get('game-session-public').attribute('data-ply');
  const ply = Number(raw ?? '0');
  return Number.isInteger(ply) ? ply : 0;
}

/**
 * The moves the person's move list shows, in order, as the game writes them:
 * a long game's latest moves beside a wide board, the shown turn in the
 * strip under a phone's.
 */
export async function readGameSessionMoveList(
  s: ProductHarness,
  actor: string
): Promise<readonly string[]> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const listed = (ply: number) =>
    ui.get(`game-session-review-move-${String(ply)}`);
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

/** Whether the person is offered to claim the win from someone away. */
export async function gameSessionClaimWinOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get('game-session-claim-win').isVisible();
}

/** Everything the game-session screen says, or `null` when it is not shown. */
export async function readGameSessionScreenText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const content = ui.get('game-session-content');
  return (await content.isVisible()) ? await content.text() : null;
}

/**
 * What the game-session screen tells the person after a refused choice: the
 * alert's words, `''` with none, or `null` when the screen is not shown.
 */
export async function readGameSessionAlert(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (!(await ui.get('game-session-content').isVisible())) return null;
  const alert = ui.get('game-session-error');
  return (await alert.isVisible()) ? ((await alert.text()) ?? '') : '';
}

/** What the seat of `side` calls whoever holds it, on the person's screen. */
export async function gameSessionSeatName(
  s: ProductHarness,
  actor: string,
  side: GameSessionSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`game-session-${side}-person`).text();
}
