import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';

/** The seat below the board, nearest the person holding the device. */
export type NearestMultiplayerSeat = {
  /** The opponent's name and rating, when it is theirs. */
  readonly opponent: string | null;
  /** Whose clock the seat carries: the first side's (`white`) or the second's. */
  readonly clock: 'white' | 'black' | null;
};

export async function nearestMultiplayerSeat(
  s: ProductHarness,
  actor: string
): Promise<NearestMultiplayerSeat> {
  await bringToFront(s, actor);
  const seat = (await actorUi(s, actor)).get('multiplayer-seat-near');
  const opponent = seat.get('multiplayer-opponent');
  let clock: 'white' | 'black' | null = null;
  for (const side of ['white', 'black'] as const)
    if (await seat.get(`multiplayer-${side}-clock`).isVisible()) clock = side;
  return {
    opponent: (await opponent.isVisible()) ? await opponent.text() : null,
    clock,
  };
}

/**
 * The earlier position a person's screen shows, as the number of moves
 * played to reach it: 0 at the start of the game. Null while their board
 * shows the current position.
 */
export async function shownEarlierPosition(
  s: ProductHarness,
  actor: string
): Promise<number | null> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  if (!(await ui.get('multiplayer-reviewing').isVisible())) return null;
  for (let ply = 1; ; ply++) {
    const move = ui.get(`multiplayer-move-${String(ply)}`);
    if (!(await move.isVisible())) return 0;
    if ((await move.attribute('aria-current')) === 'true') return ply;
  }
}

/** The description a listener hears of the position being reviewed. */
export async function shownReviewDescription(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  await bringToFront(s, actor);
  const description = (await actorUi(s, actor)).get('multiplayer-reviewing');
  return (await description.isVisible()) ? await description.text() : null;
}

/** Where a person takes their own board in the move list. */
export type MultiplayerReviewStep =
  | 'start'
  | 'back'
  | 'forward'
  | 'current'
  /** The position after this many moves, chosen in the move list. */
  | number;

const REVIEW_CONTROLS = {
  start: 'multiplayer-review-start',
  back: 'multiplayer-review-back',
  forward: 'multiplayer-review-forward',
  current: 'multiplayer-return-to-current',
} as const;

/**
 * The person reviews the matched game on the screen in front of them: goes
 * to the start, steps back or forward one move (with its control, or with
 * the keyboard's left or right arrow), returns to the current position, or
 * chooses a move in the move list.
 */
export const reviewMultiplayerMoves = scenarioAction({
  name: 'reviewMultiplayerMoves',
  act: async (
    s,
    actor: string,
    step: MultiplayerReviewStep,
    keyboard = false
  ) => {
    await bringToFront(s, actor);
    const ui = await actorUi(s, actor);
    if (typeof step === 'number')
      await ui.get(`multiplayer-move-${String(step)}`).tap();
    else if (keyboard && (step === 'back' || step === 'forward'))
      await ui
        .get('multiplayer-moves')
        .key(step === 'back' ? 'arrowLeft' : 'arrowRight');
    else await ui.get(REVIEW_CONTROLS[step]).tap();
    await s.session.waitForIdle();
  },
});

/**
 * The position the board in front of the person shows, in the game's own
 * notation: an earlier position while they review one, else the current
 * position. Null without a matched game's board.
 */
export async function shownBoardPosition(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  await bringToFront(s, actor);
  const html = await (await actorUi(s, actor)).snapshotHtml();
  const tag = html?.match(/<[^>]*data-testid="multiplayer-game"[^>]*>/)?.[0];
  return tag?.match(/data-shown-position="([^"]+)"/)?.[1] ?? null;
}
