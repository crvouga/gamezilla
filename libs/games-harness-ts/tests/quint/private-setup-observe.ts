/**
 * What `specs/games/private-setup.qnt` observes, read where people see it:
 * the game itself where Dave, always connected, sees it; each person's own
 * private setup and readiness on their own screen and device; whom each
 * person's screen shows ready; and whose private setups each person's screen
 * and device hold.
 */

import { multiplayerBoardShown } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { firstMoveCountdownSeconds } from '@libs/game-matchmaking-harness-ts/multiplayer-first-move-countdown';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { setupReadySides } from '@libs/game-matchmaking-shared-ts/game-state';
import { customGamePrivateSetupShown } from '@libs/game-session-harness-ts/custom-game-private-setup';
import { readCustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import {
  matchedPrivateSetupStatus,
  matchedSideReadinessShown,
  ownMatchedPrivateSetup,
} from '@libs/game-session-harness-ts/matched-game-private-setup';
import { deviceRowsOf } from '@libs/game-session-harness-ts/private-setup-observation';
import type {
  CustomGameParticipant,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { modelSide } from './model-game';
import {
  arrangedLayout,
  layoutOf,
  SETUP_OBSERVER,
  SETUP_PEOPLE,
  setupKind,
  setupLayouts,
  setupName,
} from './private-setup-world';

/** What a person is told while their matched private setup is not complete. */
const INCOMPLETE = 'Your private setup is incomplete.';
const SETUP_SECONDS = 120;
const FIRST_MOVE_SECONDS = 30;
const SIDES = ['white', 'black'] as const;

type Observation = Record<string, QuintValue>;

/** The people (not the bot) among the participants. */
function personsOf(participants: ReadonlyMap<string, string>): string[] {
  return [...participants.values()].filter((name) =>
    SETUP_PEOPLE.includes(name as 'alice')
  );
}

/** Whether `text` holds `setup` as a whole value, quoted at any depth. */
function holdsSetup(text: string, setup: string): boolean {
  const escaped = setup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`).test(text);
}

/**
 * The people whose private setups `viewer`'s device holds, besides their
 * own: any setup of another person's found among its rows.
 */
async function othersHeldBy(
  w: QuintHarnessWorld,
  viewer: string
): Promise<string[]> {
  const rows = await w.quiet.read(deviceRowsOf, viewer);
  return [...setupLayouts(w)]
    .filter(
      ([person, layouts]) =>
        person !== viewer &&
        Object.values(layouts).some((setup) => holdsSetup(rows, setup))
    )
    .map(([person]) => person);
}

function seatName(w: QuintHarnessWorld, seat: CustomGameParticipant): string {
  if (seat.kind === 'bot') return 'bot';
  if (seat.kind === 'person') return setupName(w, seat.person);
  return seat.kind;
}

const CUSTOM_STATUS: Readonly<Record<string, string>> = {
  configuring: 'setting up',
  active: 'under way',
  completed: 'finished',
};

async function observeCustom(w: QuintHarnessWorld): Promise<Observation> {
  const game = (await w.quiet.read(readCustomGameProbe, SETUP_OBSERVER))
    ?.current;
  if (game === null || game === undefined)
    return { kind: 'custom', status: 'no custom game shown' };
  const participants = new Map([
    ['first', seatName(w, game.white)],
    ['second', seatName(w, game.black)],
  ]);
  const persons = personsOf(participants);
  const sideOf = (person: string): CustomGameSide =>
    participants.get('first') === person ? 'white' : 'black';
  const privateSetup = new Map<QuintValue, QuintValue>();
  for (const person of persons) {
    const shown = await w.quiet.read(customGamePrivateSetupShown, person);
    privateSetup.set(person, layoutOf(w, person, shown.arranged ?? shown.own));
  }
  const readyShown = new Map<QuintValue, QuintValue>();
  const privateSetupShown = new Map<QuintValue, QuintValue>();
  for (const viewer of SETUP_PEOPLE) {
    const probe = await w.quiet.read(readCustomGameProbe, viewer);
    const seen = probe?.current ?? null;
    readyShown.set(
      viewer,
      new Set(
        seen?.status === 'configuring'
          ? seen.ready.map((side) =>
              seatName(w, side === 'white' ? seen.white : seen.black)
            )
          : []
      )
    );
    // A person playing a side is shown their own private setup there.
    privateSetupShown.set(
      viewer,
      new Set([
        ...(probe?.mySide == null ? [] : [viewer]),
        ...(await othersHeldBy(w, viewer)),
      ])
    );
  }
  const alice = await w.quiet.read(readCustomGameProbe, 'alice');
  return {
    kind: 'custom',
    participants,
    status: CUSTOM_STATUS[game.status] ?? game.status,
    privateSetup,
    ready: new Map(
      persons.map((person) => [person, game.ready.includes(sideOf(person))])
    ),
    readyShown,
    privateSetupShown,
    // A custom game counts down no time to choose or to make a first move.
    setupSeconds: 0,
    firstMoveSeconds: 0,
    movesPlayed: game.moves.length,
    sideToMove: modelSide(game.turn),
    moveWaiting: alice?.waiting === true,
  };
}

/** Whether `viewer`'s screen shows `side` ready while the setups are chosen; `null` without that panel. */
async function readinessShown(
  w: QuintHarnessWorld,
  viewer: string,
  participants: ReadonlyMap<string, string>
): Promise<string[] | null> {
  const ready: string[] = [];
  for (const side of SIDES) {
    const shown = await w.quiet.read(matchedSideReadinessShown, viewer, side);
    if (shown === null) return null;
    if (shown) ready.push(participants.get(modelSide(side)) ?? side);
  }
  return ready;
}

const CLOCK = 'private-setup:countdown';
type Countdown = { readonly elapsed: number; readonly at: number };

/** One of the matched game's countdowns as Dave's screen shows it now. */
type CountdownShown = {
  /** Which wait it is: choosing the setups, or a first move. */
  readonly phase: string;
  /** Seconds left on it, `null` once the phase is over. */
  readonly left: number | null;
  /** Seconds the phase gives. */
  readonly total: number;
  readonly now: number;
};

/**
 * The seconds Dave's countdown has run in its phase, while it shows it;
 * once the phase is over, the seconds it ran until then, carried on the
 * world's clock from its last reading to the first one after it ended.
 */
function countdownSeconds(w: QuintHarnessWorld, shown: CountdownShown): number {
  const key = `${CLOCK}:${shown.phase}`;
  if (shown.left !== null) {
    const elapsed = shown.total - shown.left;
    w.memo.set(key, { elapsed, at: shown.now } satisfies Countdown);
    w.memo.delete(`${key}:over`);
    return elapsed;
  }
  const over = w.memo.get(`${key}:over`);
  if (typeof over === 'number') return over;
  const last = w.memo.get(key) as Countdown | undefined;
  if (last === undefined) return 0;
  const ran = last.elapsed + Math.floor((shown.now - last.at) / 1000);
  w.memo.set(`${key}:over`, ran);
  return ran;
}

function matchedStatus(outcome: string | null, choosing: boolean): string {
  if (outcome === 'ongoing') return choosing ? 'setting up' : 'under way';
  if (outcome === 'aborted') return 'aborted';
  if (outcome === 'white' || outcome === 'black' || outcome === 'draw')
    return 'finished';
  return 'no matched game shown';
}

/** The matched game each of Alice and Bob holds on their own device. */
async function matchedRecords(
  w: QuintHarnessWorld
): Promise<ReadonlyMap<string, MultiplayerGame | null>> {
  const records = new Map<string, MultiplayerGame | null>();
  for (const person of ['alice', 'bob'])
    records.set(person, (await w.quiet.read(multiplayerView, person)).game);
  return records;
}

/**
 * A person's own private setup in their matched game: the one their device
 * holds once chosen; before that, incomplete while their screen says so,
 * else the complete one they last arranged on their setup board.
 */
async function matchedOwnSetup(
  w: QuintHarnessWorld,
  person: string
): Promise<string> {
  const chosen = await w.quiet.read(ownMatchedPrivateSetup, person);
  if (chosen !== null) return layoutOf(w, person, chosen);
  const told = await w.quiet.read(matchedPrivateSetupStatus, person);
  if (told === INCOMPLETE) return 'incomplete';
  return arrangedLayout(w, person) ?? 'incomplete';
}

/** Whom each person's screen shows ready, and whose setups they hold. */
async function matchedViews(
  w: QuintHarnessWorld,
  participants: ReadonlyMap<string, string>,
  records: ReadonlyMap<string, MultiplayerGame | null>
) {
  const persons = personsOf(participants);
  const readyShown = new Map<QuintValue, QuintValue>();
  const privateSetupShown = new Map<QuintValue, QuintValue>();
  for (const viewer of SETUP_PEOPLE) {
    readyShown.set(
      viewer,
      new Set((await readinessShown(w, viewer, participants)) ?? [])
    );
    // A person playing a side is shown their own private setup there.
    const plays = persons.includes(viewer) && records.get(viewer) != null;
    privateSetupShown.set(
      viewer,
      new Set([...(plays ? [viewer] : []), ...(await othersHeldBy(w, viewer))])
    );
  }
  return { readyShown, privateSetupShown };
}

async function observeMatched(w: QuintHarnessWorld): Promise<Observation> {
  const board = await w.quiet.read(multiplayerBoardShown, SETUP_OBSERVER);
  const records = await matchedRecords(w);
  const record = records.get('alice') ?? null;
  const participants = new Map([
    ['first', record === null ? 'nobody' : setupName(w, record.white_id)],
    ['second', record === null ? 'nobody' : setupName(w, record.black_id)],
  ]);
  const persons = personsOf(participants);
  const observerReady = await readinessShown(w, SETUP_OBSERVER, participants);
  const status = matchedStatus(board.outcome, observerReady !== null);
  // Each person's own device knows whether they chose: only they can.
  const ready = new Map<QuintValue, QuintValue>();
  const privateSetup = new Map<QuintValue, QuintValue>();
  for (const person of persons) {
    const own = records.get(person) ?? null;
    const side = participants.get('first') === person ? 'white' : 'black';
    ready.set(person, own !== null && setupReadySides(own).includes(side));
    privateSetup.set(person, await matchedOwnSetup(w, person));
  }
  const now = await w.quiet.read((s) => s.harness.clock.now());
  const left = await w.quiet.read(firstMoveCountdownSeconds, SETUP_OBSERVER);
  const moves = Math.max(0, board.revision);
  const bothReady = persons.every((person) => ready.get(person) === true);
  return {
    kind: board.gameId === null ? 'no matched game shown' : 'matched',
    participants,
    status,
    privateSetup,
    ready,
    ...(await matchedViews(w, participants, records)),
    setupSeconds: countdownSeconds(w, {
      phase: 'setup',
      left: status === 'setting up' ? left : null,
      total: SETUP_SECONDS,
      now,
    }),
    firstMoveSeconds:
      bothReady && moves < 2
        ? countdownSeconds(w, {
            phase: `first move ${String(moves)}`,
            left: status === 'under way' ? left : null,
            total: FIRST_MOVE_SECONDS,
            now,
          })
        : 0,
    movesPlayed: moves,
    // Turns alternate: the moves shown leave the side to move.
    sideToMove: moves % 2 === 0 ? 'first' : 'second',
    // A matched game keeps no move waiting: one made offline is refused.
    moveWaiting: false,
  };
}

/** The model's variables, read without acting. */
export async function observeSetupModel(
  w: QuintHarnessWorld
): Promise<Observation> {
  return setupKind(w) === 'custom' ? observeCustom(w) : observeMatched(w);
}
