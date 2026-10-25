/**
 * The Hearts world: the table a scenario's Givens describe, set up once they
 * have all been read. A first deal cannot change once the game starts, and
 * a scenario often names what is played before it names what the deal
 * holds ("South has led the two of clubs", then "West holds no clubs"), so
 * each fact Given adds to a plan and the table is set up, through ordinary
 * choices and the room's documented deal, before the first event or
 * observation. A Given that acts on the table sets it up first.
 */

import { expect } from 'bun:test';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  establishHearts,
  type HeartsLineup,
  passAnyThreeHeartsCards,
  passHeartsCards,
} from '@libs/hearts-harness-ts/hearts-actions';
import type { HeartsLine } from '@libs/hearts-harness-ts/hearts-lines';
import {
  type HeartsTable,
  lineAt,
} from '@libs/hearts-harness-ts/hearts-tables';
import {
  type HeartsView,
  heartsView,
} from '@libs/hearts-harness-ts/hearts-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

export type HeartsWorld = Pick<HarnessWorld, 's' | 'memo'>;

const SETTLE_MS = 15_000;
const PLAN = 'hearts-plan';
const SET_UP = 'hearts-set-up';
const BEFORE = 'hearts-before';
export const SIDES: readonly GameSide[] = ['white', 'black', 'red', 'blue'];

/** What the Givens have said of the table so far. */
type Plan = HeartsLineup & {
  /** A hand-written table and the stage of it reached. */
  readonly table?: HeartsTable;
  readonly stage?: string;
  /** Preconditions to confirm once the table is set up. */
  readonly guards?: readonly ((w: HeartsWorld) => Promise<void>)[];
};

/** What the Givens have said of the table so far. */
export function planned(w: HeartsWorld): Plan {
  return planOf(w);
}

function planOf(w: HeartsWorld): Plan {
  return (w.memo.get(PLAN) as Plan | undefined) ?? {};
}

/** Add to what the Givens say of the table, before it is set up. */
export function plan(w: HeartsWorld, more: Plan): void {
  if (w.memo.get(SET_UP) === true)
    throw new Error('the Hearts table is already set up');
  const known = planOf(w);
  w.memo.set(PLAN, {
    ...known,
    ...more,
    guards: [...(known.guards ?? []), ...(more.guards ?? [])],
  });
}

/** A precondition the scenario states, confirmed once the table is set up. */
export function guard(
  w: HeartsWorld,
  check: (w: HeartsWorld) => Promise<void>
) {
  plan(w, { guards: [check] });
}

/**
 * The line played fast as the game's earlier history. With a stand-in to
 * bring in, the history stops once the first deal's passes have changed
 * hands, and the rest of the stage is played after the stand-in arrives
 * (`then`), so the stand-in decides only for what comes after it.
 */
function linesOf(known: Plan): {
  readonly line: HeartsLine | undefined;
  readonly then: readonly string[] | undefined;
} {
  if (known.table === undefined) return { line: known.line, then: known.then };
  const line = lineAt(known.table, known.stage ?? 'passed');
  if (known.away === undefined) return { line, then: known.then };
  const passed = known.table.stages['passed'] ?? 1;
  return {
    line: { ...line, history: line.history.slice(0, passed) },
    then: [...line.history.slice(passed), ...(known.then ?? [])],
  };
}

/** The line the table's history was played from, once set up. */
export function plannedLine(w: HeartsWorld): HeartsLine {
  const line = linesOf(planOf(w)).line;
  if (line === undefined) throw new Error('the table has no planned line');
  return line;
}

/** The people seated, by side. */
export function seated(w: HeartsWorld): Readonly<Record<GameSide, string>> {
  const seats = planOf(w).seats;
  return {
    white: String(seats?.white ?? 'alice'),
    black: String(seats?.black ?? 'bob'),
    red: String(seats?.red ?? 'carol'),
    blue: String(seats?.blue ?? 'dave'),
  };
}

/** The people at the table: those seated and those watching. */
export function people(w: HeartsWorld): readonly string[] {
  const seats = seated(w);
  return [
    ...SIDES.map((side) => seats[side]).filter(
      (seat) => seat !== 'bot' && seat !== 'open'
    ),
    ...(planOf(w).watchers ?? []),
  ];
}

/** Set the table up as the Givens describe it, unless it already is. */
export async function table(w: HeartsWorld): Promise<void> {
  if (w.memo.get(SET_UP) === true) return;
  const known = planOf(w);
  const { line, then } = linesOf(known);
  const { table: _table, stage: _stage, guards = [], ...lineup } = known;
  await w.s.apply(establishHearts, {
    ...lineup,
    ...(line === undefined ? {} : { line }),
    ...(then === undefined ? {} : { then }),
  });
  w.memo.set(SET_UP, true);
  for (const check of guards) await check(w);
  await remember(w);
}

export function sees(w: HeartsWorld, actor: string): Promise<HeartsView> {
  return w.s.read(heartsView, actor);
}

/** What `actor` sees once `pred` holds, within the time a sync takes. */
export function seesOnce(
  w: HeartsWorld,
  actor: string,
  pred: (view: HeartsView) => boolean
): Promise<HeartsView> {
  return w.s.until((s) => heartsView(s, actor), { maxMs: SETTLE_MS, pred });
}

/** Every person's view of the table now, kept to compare with after an event. */
export async function remember(w: HeartsWorld): Promise<void> {
  const views: Record<string, HeartsView> = {};
  for (const person of people(w)) views[person] = await sees(w, person);
  w.memo.set(BEFORE, views);
}

export function remembered(w: HeartsWorld, actor: string): HeartsView {
  const view = (w.memo.get(BEFORE) as Record<string, HeartsView> | undefined)?.[
    actor
  ];
  if (view === undefined) throw new Error(`No earlier view of ${actor}`);
  return view;
}

/** The cards `view`'s own hand shows, in the order shown. */
export function held(view: HeartsView): readonly string[] {
  return view.hand.map((card) => card.card);
}

/** The cards `view`'s hand shows as chosen to pass. */
export function chosen(view: HeartsView): readonly string[] {
  return view.hand.filter((card) => card.chosen).map((card) => card.card);
}

/** The cards in the trick shown, by the seat that played each. */
export function trick(view: HeartsView): Partial<Record<GameSide, string>> {
  const cards: Partial<Record<GameSide, string>> = {};
  for (const side of SIDES) {
    const played = view.seats[side]?.played;
    if (played != null) cards[side] = played;
  }
  return cards;
}

/** The facts `view` shows of `side`'s seat. */
export function facts(view: HeartsView, side: GameSide): readonly string[] {
  const seat = view.seats[side];
  if (seat === undefined) throw new Error(`${side} has no seat on the table`);
  return seat.facts;
}

/** The cumulative score `view` shows for `side`. */
export function score(view: HeartsView, side: GameSide): number {
  const shown = facts(view, side).find((fact) => /^Score \d+$/.test(fact));
  if (shown === undefined) throw new Error(`${side} shows no score`);
  return Number(shown.slice('Score '.length));
}

/** How many cards `view` shows `side` holding. */
export function cardsHeldBy(view: HeartsView, side: GameSide): number {
  const shown = facts(view, side).find((fact) => /^\d+ cards?$/.test(fact));
  if (shown === undefined) throw new Error(`${side} shows no card count`);
  return Number.parseInt(shown, 10);
}

/** Whether `view` shows `side` has passed. */
export function hasPassed(view: HeartsView, side: GameSide): boolean {
  return facts(view, side).includes('Passed');
}

/** The side whose seat `view` marks as deciding now, if exactly one. */
export function deciding(view: HeartsView): GameSide | null {
  const marked = SIDES.filter((side) => view.seats[side]?.deciding === true);
  return marked.length === 1 ? marked[0]! : null;
}

/** `actor` holds every one of `cards`. */
export async function holds(
  w: HeartsWorld,
  actor: string,
  cards: readonly string[]
): Promise<void> {
  const hand = held(await sees(w, actor));
  for (const card of cards) expect(hand).toContain(card);
}

const PASSED = 'hearts-passed';

export function sorted(cards: readonly string[]): string[] {
  return [...cards].sort();
}

/** What each seat passed, as its own hand showed it chosen. */
export function passedBy(
  w: HeartsWorld
): Partial<Record<GameSide, readonly string[]>> {
  return (
    (w.memo.get(PASSED) as Partial<Record<GameSide, readonly string[]>>) ?? {}
  );
}

/** The seat `actor` plays. */
export function sideOf(w: HeartsWorld, actor: string): GameSide {
  const seats = seated(w);
  const side = SIDES.find((each) => seats[each] === actor);
  if (side === undefined) throw new Error(`${actor} plays no seat`);
  return side;
}

/** Keep the pass `actor` chose, to say later who received which cards. */
export function noteChoice(
  w: HeartsWorld,
  actor: string,
  cards: readonly string[]
): void {
  w.memo.set(PASSED, { ...passedBy(w), [sideOf(w, actor)]: cards });
}

/** `actor` passes (`cards`, or three of their choosing), and what they chose is kept. */
export async function pass(
  w: HeartsWorld,
  actor: string,
  cards?: readonly string[]
): Promise<void> {
  if (cards === undefined) await w.s.apply(passAnyThreeHeartsCards, actor);
  else await w.s.apply(passHeartsCards, actor, cards);
  const view = await seesOnce(w, actor, (v) => v.pass === null);
  noteChoice(w, actor, chosen(view));
}

/** The cards of `cards` that `view`'s page shows, as a card or as a pass written out. */
export function shownOf(
  view: HeartsView,
  cards: readonly string[]
): readonly string[] {
  const written = sorted(cards).join('');
  return [
    ...cards.filter((card) => view.cardsOnPage.includes(card)),
    ...(cards.length > 0 && view.page.includes(written) ? [written] : []),
  ];
}
