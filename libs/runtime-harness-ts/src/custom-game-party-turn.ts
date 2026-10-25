import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { PublicCustomGame } from './custom-game-party-journey';
import { check, JOURNEY_WAIT_MS, tap } from './journey-gestures';

/** Read one rendered snapshot, including whether this device can act on it. */
export async function readPublicCustomGame(
  ui: Driver
): Promise<PublicCustomGame> {
  const raw = await ui.get('custom-game-public').attribute('data-state');
  check(raw !== null, 'The custom game has no public board state');
  const value = JSON.parse(raw) as PublicCustomGame;
  check(
    typeof value.position === 'string' &&
      typeof value.status === 'string' &&
      typeof value.turn === 'string' &&
      typeof value.outcome === 'string' &&
      typeof value.canMove === 'boolean' &&
      Number.isInteger(value.ply),
    'The public custom game is incomplete'
  );
  return value;
}

function moveContext(view: PublicCustomGame | null): string {
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

async function performObservedMove(
  ui: Driver,
  game: PlayableGame,
  view: PublicCustomGame,
  action: string
): Promise<void> {
  try {
    await game.shared.automation.turns.perform(ui, 'custom-game-board', action);
  } catch (cause) {
    const latest = await readPublicCustomGame(ui).catch(() => null);
    throw new Error(
      `Party action ${action.slice(0, 80)}; chosen ${moveContext(view)}; latest ${moveContext(latest)}`,
      { cause }
    );
  }
}

const MOVE_ATTEMPTS = 3;
const MOVE_SETTLE_MS = 5_000;

/** Whether the board changed under a move chosen from `chosen`, at the same ply. */
async function replacedBoard(
  ui: Driver,
  chosen: PublicCustomGame
): Promise<PublicCustomGame | null> {
  const latest = await readPublicCustomGame(ui).catch(() => null);
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
  shown: PublicCustomGame
): Promise<void> {
  let view = shown;
  for (let attempt = 1; ; attempt += 1) {
    const action = game.shared.automation.turns.choose(
      view.position,
      () => 0.25
    );
    check(
      action !== null,
      'The active participant has no automated legal action'
    );
    const last = attempt === MOVE_ATTEMPTS;
    const accepted = ui.get(`custom-game-review-move-${view.ply + 1}`);
    let performed = false;
    try {
      await performObservedMove(ui, game, view, action);
      performed = true;
      await accepted.expect.visible({
        timeoutMs: last ? JOURNEY_WAIT_MS : MOVE_SETTLE_MS,
      });
      return;
    } catch (error) {
      const replaced = last ? null : await replacedBoard(ui, view);
      if (replaced !== null) {
        view = replaced;
        continue;
      }
      if (!performed || last) throw error;
      // Not replaced, only slow: the move still has its full wait.
      await accepted.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
      return;
    }
  }
}

/** A parked observer's position is never the acting person's decision. */
export async function playCustomGamePartyTurn(
  ui: Driver,
  game: PlayableGame,
  expected: PublicCustomGame,
  progress: { returnedLiveAt: number | null }
): Promise<number> {
  if (expected.ply > 0)
    await ui
      .get(`custom-game-review-move-${expected.ply}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  let view = await readPublicCustomGame(ui);
  if (view.status === 'completed' || view.turn !== expected.turn)
    return view.ply;
  check(view.status === 'active', 'The party game never started');
  if (!view.canMove && progress.returnedLiveAt !== view.ply) {
    await tap(ui, 'custom-game-review-live');
    progress.returnedLiveAt = view.ply;
    view = await readPublicCustomGame(ui);
  }
  if (
    view.status === 'completed' ||
    view.turn !== expected.turn ||
    !view.canMove
  )
    return view.ply;
  await playOnSettledBoard(ui, game, view);
  return view.ply + 1;
}
