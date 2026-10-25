import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  LIGHT_CYCLES_RIDER_NAMES,
  type LightCyclesRiderName,
  lightCyclesBoard,
  lightCyclesBoardShown,
  lightCyclesRider,
} from './light-cycles-board-view';
import { everyoneSeeing, lightCyclesObserver } from './light-cycles-lineup';

const SEATS = ['white', 'black', 'red', 'blue'] as const;

/** A rider as the game's creator sees it, or as `actor` does. */
export async function riderShown(
  s: ProductHarness,
  rider: LightCyclesRiderName,
  actor?: string
) {
  return lightCyclesRider(s, rider, actor ?? lightCyclesObserver(s));
}

/**
 * Whether `actor`'s device offers steering `rider` now (its direction pad,
 * enabled), and what the device says about its own steering: watching,
 * away, finished, round-over, crashed, countdown or riding; `none` when no
 * arena is shown at all.
 */
export async function steeringShown(
  s: ProductHarness,
  actor: string,
  rider: LightCyclesRiderName
): Promise<{ readonly offered: boolean; readonly status: string }> {
  const board = await lightCyclesBoard(s, actor);
  if (board === null) return { offered: false, status: 'none' };
  const seat = SEATS[LIGHT_CYCLES_RIDER_NAMES.indexOf(rider)]!;
  const pad = (await actorUi(s, actor)).get(`${board.board}-${seat}-pad-up`);
  const offered =
    (await pad.isVisible()) && (await pad.attribute('disabled')) === null;
  return { offered, status: board.steering };
}

/** Who holds `rider`'s seat in the custom game `actor` sees: a person's identity, or a bot. */
export async function seatShown(
  s: ProductHarness,
  actor: string,
  rider: LightCyclesRiderName
): Promise<{ readonly kind: string; readonly person: string } | null> {
  const game = (await readCustomGameScreen(s, actor))?.current;
  if (game == null) return null;
  return game[SEATS[LIGHT_CYCLES_RIDER_NAMES.indexOf(rider)]!];
}

/** Where the custom game `actor` sees stands: configuring, active, completed or cancelled. */
export async function customGameStatusShown(
  s: ProductHarness,
  actor: string
): Promise<string> {
  return (await readCustomGameScreen(s, actor))?.current?.status ?? 'none';
}

/** The arena as the game's creator sees it, or as `actor` does. */
export async function arenaShown(s: ProductHarness, actor?: string) {
  return lightCyclesBoardShown(s, actor ?? lightCyclesObserver(s));
}

/** Each rider's round wins on the observer's board (or `actor`'s), by name. */
export async function roundWinsShown(
  s: ProductHarness,
  actor?: string
): Promise<Partial<Record<LightCyclesRiderName, number>>> {
  const board = await arenaShown(s, actor);
  return Object.fromEntries(
    board.riders.map((rider) => [rider.name, rider.score])
  );
}

/** What the banner over the arena says on the board of everyone who can see it. */
export async function bannersShown(s: ProductHarness): Promise<string[]> {
  const shown: string[] = [];
  for (const person of await everyoneSeeing(s))
    shown.push((await lightCyclesBoardShown(s, person)).overlay);
  return shown;
}

/**
 * What one person's board shows of the game, as another's would: the arena,
 * trails, riders, score, round and countdown, without who steers here.
 */
export async function gameSeenBy(s: ProductHarness, actor: string) {
  const board = await lightCyclesBoardShown(s, actor);
  return {
    round: board.round,
    phase: board.phase,
    targetScore: board.targetScore,
    banner: board.overlay,
    crashes: board.crashes,
    riders: board.riders.map(({ steeredHere: _here, ...rider }) => rider),
  };
}

/** Each of the two people's view of the game, read at the same moment. */
export async function gamesSeenBy(
  s: ProductHarness,
  first: string,
  second: string
) {
  return [await gameSeenBy(s, first), await gameSeenBy(s, second)] as const;
}

/**
 * How `actor`'s screen shows who rides `rider` while the custom game is
 * set up: a bot (with its level, when the seat names one), or not a bot.
 */
export async function botShown(
  s: ProductHarness,
  actor: string,
  rider: LightCyclesRiderName
): Promise<{ readonly bot: boolean; readonly level: string | null }> {
  const side = SEATS[LIGHT_CYCLES_RIDER_NAMES.indexOf(rider)]!;
  const text =
    (await (
      await actorUi(s, actor)
    )
      .get(`custom-game-${side}-person`)
      .text()) ?? '';
  const level = text.match(/\((easy|medium|hard)\)/)?.[1] ?? null;
  return { bot: text.startsWith('Bot'), level };
}

/** The member identity `actor`'s custom game screen knows them by. */
export async function identityShown(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const me = (await readCustomGameScreen(s, actor))?.me;
  if (me === undefined) throw new Error(`${actor} sees no custom game`);
  return me;
}
