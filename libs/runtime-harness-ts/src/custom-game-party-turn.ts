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
  const action = game.shared.automation.turns.choose(view.position, () => 0.25);
  check(
    action !== null,
    'The active participant has no automated legal action'
  );
  await performObservedMove(ui, game, view, action);
  await ui
    .get(`custom-game-review-move-${view.ply + 1}`)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  return view.ply + 1;
}
