import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { PublicGameSession } from './game-session-party-journey';
import { check, JOURNEY_WAIT_MS, tap } from './journey-gestures';

/** Read one rendered snapshot, including whether this device can act on it. */
export async function readPublicGameSession(
  ui: Driver
): Promise<PublicGameSession> {
  const raw = await ui.get('game-session-public').attribute('data-state');
  check(raw !== null, 'The game session has no public board state');
  const value = JSON.parse(raw) as PublicGameSession;
  check(
    typeof value.position === 'string' &&
      typeof value.status === 'string' &&
      typeof value.turn === 'string' &&
      typeof value.outcome === 'string' &&
      typeof value.canMove === 'boolean' &&
      Number.isInteger(value.ply),
    'The public game session is incomplete'
  );
  return value;
}

export function partyMoveContext(view: PublicGameSession | null): string {
  return JSON.stringify(
    view === null
      ? null
      : {
          position: view.position.slice(-400),
          status: view.status.slice(0, 32),
          turn: view.turn.slice(0, 16),
          outcome: view.outcome.slice(0, 80),
          ply: view.ply,
          canMove: view.canMove,
        }
  );
}

async function moveFailure(
  ui: Driver,
  view: PublicGameSession,
  action: string,
  cause: unknown
): Promise<Error> {
  const latest = await readPublicGameSession(ui).catch(() => null);
  return new Error(
    `Party action ${action.slice(0, 80)}; chosen ${partyMoveContext(view)}; latest ${partyMoveContext(latest)}`,
    { cause }
  );
}

async function performObservedMove(
  ui: Driver,
  game: PlayableGame,
  view: PublicGameSession,
  action: string
): Promise<void> {
  try {
    await game.shared.automation.turns.perform(
      ui,
      'game-session-board',
      action
    );
  } catch (cause) {
    throw await moveFailure(ui, view, action, cause);
  }
}

async function failRejectedMove(
  ui: Driver,
  view: PublicGameSession,
  action: string,
  cause: unknown
): Promise<void> {
  const error = ui.get('game-session-error');
  if (await error.isVisible())
    throw await moveFailure(
      ui,
      view,
      action,
      new Error(`Party move rejected: ${await error.text()}`, { cause })
    );
}

const MOVE_ATTEMPTS = 3;
const MOVE_SETTLE_MS = 5_000;

export type PartyTurnProgress = {
  returnedLiveAt: number | null;
  attempted: {
    readonly chosen: PublicGameSession;
    readonly action: string;
  } | null;
};

/** Whether the board changed under a move chosen from `chosen`, at the same ply. */
async function replacedBoard(
  ui: Driver,
  chosen: PublicGameSession
): Promise<PublicGameSession | null> {
  const latest = await readPublicGameSession(ui).catch(() => null);
  return latest !== null &&
    latest.ply === chosen.ply &&
    latest.canMove &&
    latest.position !== chosen.position
    ? latest
    : null;
}

/**
 * Choose, play and see the move accepted. The host's device shows its own
 * choice for a bot until the room's replaces it, so a move chosen from a
 * board that then changed at the same ply is chosen again.
 */
async function playOnSettledBoard(
  ui: Driver,
  game: PlayableGame,
  shown: PublicGameSession,
  progress: PartyTurnProgress
): Promise<void> {
  let view = shown;
  for (let attempt = 1; ; attempt += 1) {
    const action = game.shared.automation.turns.choose(
      view.position,
      () => 0.25,
      null
    );
    check(
      action !== null,
      'The active participant has no automated legal action'
    );
    const last = attempt === MOVE_ATTEMPTS;
    const accepted = ui.get(`game-session-review-move-${view.ply + 1}`);
    progress.attempted = { chosen: view, action };
    let performed = false;
    try {
      await performObservedMove(ui, game, view, action);
      performed = true;
      await accepted.expect.visible({
        timeoutMs: last ? JOURNEY_WAIT_MS : MOVE_SETTLE_MS,
      });
      return;
    } catch (error) {
      await failRejectedMove(ui, view, action, error);
      const replaced = last ? null : await replacedBoard(ui, view);
      if (replaced !== null) {
        view = replaced;
        continue;
      }
      if (!performed) throw error;
      if (last) throw await moveFailure(ui, view, action, error);
      // Not replaced, only slow: the move still has its full wait.
      try {
        await accepted.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
      } catch (cause) {
        throw await moveFailure(ui, view, action, cause);
      }
      return;
    }
  }
}

/** A parked observer's position is never the acting person's decision. */
export async function playGameSessionPartyTurn(
  ui: Driver,
  game: PlayableGame,
  expected: PublicGameSession,
  progress: PartyTurnProgress
): Promise<number> {
  progress.attempted = null;
  if (expected.ply > 0)
    await ui
      .get(`game-session-review-move-${expected.ply}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  let view = await readPublicGameSession(ui);
  if (view.status === 'completed' || view.turn !== expected.turn)
    return view.ply;
  check(view.status === 'active', 'The party game never started');
  if (!view.canMove && progress.returnedLiveAt !== view.ply) {
    // The live board never shows an earlier move: a person looking back is
    // on the moves place, and returns to the game from there.
    if (await ui.get('game-session-back-to-live').isVisible())
      await tap(ui, 'game-session-back-to-live');
    progress.returnedLiveAt = view.ply;
    view = await readPublicGameSession(ui);
  }
  if (
    view.status === 'completed' ||
    view.turn !== expected.turn ||
    !view.canMove
  )
    return view.ply;
  await playOnSettledBoard(ui, game, view, progress);
  return view.ply + 1;
}
