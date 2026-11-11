/**
 * Finding an opponent is a set of small screens (places); only one shows at
 * a time. A person reaches a control on another place by pressing the row
 * that leads there, and these drivers do the same: they open the place,
 * act or read, and a read that opened a place steps back out with Back.
 */

import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** The mark every place of finding an opponent carries: its stage and place. */
export const MULTIPLAYER_SCREEN = 'multiplayer-screen';

/** A place a person opens by a row; `find` is also where an idle screen opens. */
export type MultiplayerOpenedPlace =
  | 'find'
  | 'time-control'
  | 'ratings'
  | 'guide'
  | 'commands'
  | 'moves';

/** The place each stage opens on, where its rows that lead onward are. */
const HOME_OF: Readonly<Record<string, string>> = {
  loading: 'status',
  unavailable: 'status',
  denied: 'status',
  idle: 'find',
  searching: 'searching',
  setup: 'private-setup',
  playing: 'play',
  finished: 'result',
};

/**
 * The rows a person presses to reach each place, one way per place that
 * offers the first of them. After a game the search's hub is one row from
 * the result, and the clock and the guide a second row from there; the
 * moves are one row from a result and two (the game's commands, then its
 * moves) from play.
 */
const WAYS: Readonly<
  Record<MultiplayerOpenedPlace, readonly (readonly string[])[]>
> = {
  find: [['multiplayer-open-find']],
  'time-control': [
    ['multiplayer-open-time-control'],
    ['multiplayer-open-find', 'multiplayer-open-time-control'],
  ],
  ratings: [['multiplayer-open-ratings']],
  guide: [
    ['multiplayer-open-guide'],
    ['multiplayer-open-find', 'multiplayer-open-guide'],
  ],
  commands: [['multiplayer-open-commands']],
  moves: [
    ['multiplayer-open-moves'],
    ['multiplayer-open-commands', 'multiplayer-open-moves'],
  ],
};

const COMMANDS: ReadonlySet<string> = new Set([
  'multiplayer-offer-draw',
  'multiplayer-flip-board',
  'multiplayer-abort',
  'multiplayer-resign',
]);

const HUB: ReadonlySet<string> = new Set([
  'multiplayer-find',
  'multiplayer-find-conditions',
  'multiplayer-find-space',
]);

const KEPT: ReadonlySet<string> = new Set([
  'multiplayer-game-record',
  'multiplayer-final-position',
  'multiplayer-moves',
]);

/**
 * The place holding a control that a stage's home may not show; `null` for
 * a control of the homes themselves (the board, the wait, the result).
 */
export function multiplayerPlaceHolding(
  testId: string
): MultiplayerOpenedPlace | null {
  if (HUB.has(testId)) return 'find';
  if (testId.startsWith('multiplayer-time-control-')) return 'time-control';
  if (testId === 'multiplayer-rating-change') return null;
  if (testId.startsWith('multiplayer-rating-')) return 'ratings';
  if (testId === 'multiplayer-guide') return 'guide';
  if (COMMANDS.has(testId)) return 'commands';
  if (
    KEPT.has(testId) ||
    testId.startsWith('multiplayer-copy-') ||
    testId.startsWith('multiplayer-review-')
  )
    return 'moves';
  return null;
}

type Shown = { readonly stage: string | null; readonly place: string | null };

/** The stage and place `actor`'s device shows; null off finding an opponent. */
async function shown(s: ProductHarness, actor: string): Promise<Shown | null> {
  const screen = (await actorUi(s, actor)).get(MULTIPLAYER_SCREEN);
  if (!(await screen.isVisible())) return null;
  return {
    stage: await screen.attribute('data-stage'),
    place: await screen.attribute('data-place'),
  };
}

const atHome = (at: Shown): boolean =>
  at.stage !== null && HOME_OF[at.stage] === at.place;

/** The place `actor`'s device shows; null off finding an opponent. */
export async function multiplayerPlaceShown(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (await shown(s, actor))?.place ?? null;
}

/** Waits until the device shows another place than `from`. */
async function moved(
  s: ProductHarness,
  actor: string,
  from: string | null
): Promise<void> {
  await pollUntil(
    s,
    async () =>
      (await multiplayerPlaceShown(s, actor)) === from ? null : true,
    {
      maxMs: 5000,
      stepMs: 1,
      description: `${actor} leaving ${from ?? 'nowhere'}`,
    }
  );
}

/**
 * One step back within finding an opponent, as the bar's Back takes it.
 * From a stage's home it does nothing: that Back would leave the screen.
 */
export async function leaveMultiplayerPlace(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const at = await shown(s, actor);
  if (at === null || atHome(at)) return;
  await (await actorUi(s, actor)).get(Handles.navBack).tap();
  await moved(s, actor, at.place);
}

/** Back to the place the stage opens on, however many rows led away. */
export async function returnToMultiplayerHome(
  s: ProductHarness,
  actor: string
): Promise<void> {
  for (let step = 0; step < 3; step++) {
    const at = await shown(s, actor);
    if (at === null || atHome(at)) return;
    await leaveMultiplayerPlace(s, actor);
  }
}

/** How a row is pressed: with a finger, or with Enter by the keyboard alone. */
export type MultiplayerPress = 'tap' | 'enter';

/** Presses `way`'s rows in turn; false when one of them is not offered. */
async function follow(
  s: ProductHarness,
  actor: string,
  way: readonly string[],
  press: MultiplayerPress
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  for (const row of way) {
    const from = await multiplayerPlaceShown(s, actor);
    if (!(await ui.get(row).isVisible())) return false;
    if (press === 'enter') await ui.get(row).key('enter');
    else await ui.get(row).tap();
    await moved(s, actor, from);
  }
  return true;
}

/** Follows the first way to `place` the screen in front of `actor` offers. */
async function openFromHere(
  s: ProductHarness,
  actor: string,
  place: MultiplayerOpenedPlace,
  press: MultiplayerPress
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  for (const way of WAYS[place]) {
    if (!(await ui.get(way[0] ?? '').isVisible())) continue;
    if (await follow(s, actor, way, press)) return true;
    // The way stopped short (commands with no moves to step through).
    await returnToMultiplayerHome(s, actor);
  }
  return false;
}

/**
 * `actor` opens `place` as a person does, from wherever in finding an
 * opponent their device is: `shown` when it already shows it, `opened`
 * once the rows that lead there were pressed, and `unreachable` when the
 * stage offers no such place (the commands of a finished game, the ratings
 * during play), leaving the device on the stage's home.
 */
export async function openMultiplayerPlace(
  s: ProductHarness,
  actor: string,
  place: MultiplayerOpenedPlace,
  press: MultiplayerPress = 'tap'
): Promise<'shown' | 'opened' | 'unreachable'> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = await shown(s, actor);
    if (at === null) return 'unreachable';
    if (at.place === place) return attempt === 0 ? 'shown' : 'opened';
    if (await openFromHere(s, actor, place, press)) return 'opened';
    const here = await shown(s, actor);
    if (here === null || atHome(here)) return 'unreachable';
    // Another opened place: the rows that lead on are behind it.
    await leaveMultiplayerPlace(s, actor);
  }
  return 'unreachable';
}

/**
 * Reads on `place`: opens it, reads, and steps back to the stage's home
 * when the read was what opened it. A place the stage does not offer is
 * read as it is: its controls are on no screen, which is what the read
 * then says.
 */
export async function onMultiplayerPlace<T>(
  s: ProductHarness,
  actor: string,
  place: MultiplayerOpenedPlace | null,
  read: () => Promise<T>
): Promise<T> {
  if (place === null) return read();
  const how = await openMultiplayerPlace(s, actor, place);
  try {
    return await read();
  } finally {
    if (how === 'opened') await returnToMultiplayerHome(s, actor);
  }
}

/**
 * The move list is on the game in play and on its moves. `actor`'s device
 * shows one of them after this: the moves are opened from a result, which
 * lists none. Returns whether it opened them, for a read to step back out.
 */
export async function showMultiplayerMoveList(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  if (await ui.get('multiplayer-move-list').isVisible()) return false;
  return (await openMultiplayerPlace(s, actor, 'moves')) === 'opened';
}

/**
 * `actor` presses a control wherever finding an opponent keeps it: on the
 * screen in front of them, or on the place it lives on, opened first.
 */
export async function tapMultiplayerControl(
  s: ProductHarness,
  actor: string,
  testId: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  const place = multiplayerPlaceHolding(testId);
  if (place !== null && !(await ui.get(testId).isVisible()))
    await openMultiplayerPlace(s, actor, place);
  await ui.get(testId).tap();
}
