/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  type JSX,
  on,
  Show,
} from 'solid-js';
import { Button } from '../button/index';
import styles from './card-table.module.css';

export type CardSuit = 'clubs' | 'diamonds' | 'spades' | 'hearts';
export type CardTablePosition = 'bottom' | 'left' | 'top' | 'right';

/** A face-up card: its rank, its suit, and its full name for listeners. */
export type CardTableCard = {
  readonly id: string;
  readonly rank: string;
  readonly suit: CardSuit;
  /** The suit's name in the reader's language, shown under its symbol: `spades`. */
  readonly suitName: string;
  /** Spoken and written name, `Queen of spades`. */
  readonly label: string;
};

export type CardTableSeat = {
  readonly position: CardTablePosition;
  readonly name: string;
  /** Each fact its own tag: `12 cards`, `34 points`, `Passed`. */
  readonly facts: readonly string[];
  /** Whether this seat decides now. */
  readonly active: boolean;
  /** The card this seat put on the table in the trick under way. */
  readonly played: CardTableCard | null;
  readonly testId: string;
  /**
   * The person in the seat (`GameTableSeat`: avatar, name, tags), when the
   * host knows them; the seat's `name` stays its accessible name.
   */
  readonly player?: JSX.Element | undefined;
  /**
   * Where the seat is in the phase open now (`Choosing`, `Passed`): shown
   * among its facts, or, with a `player` whose tags already say it, kept
   * for a listener only.
   */
  readonly status?: string | undefined;
};

export type CardTableHandCard = CardTableCard & {
  /** Whether the rules allow this card now. */
  readonly enabled: boolean;
  /** Whether it is chosen, while cards are chosen (`null` when a card acts at once). */
  readonly selected: boolean | null;
  /** Why the rules do not allow it, said when it is pressed anyway. */
  readonly refusal?: string | undefined;
};

export type CardTableAction = {
  readonly label: string;
  /** Beside the action, how far the selection is (`2 of 3 chosen`). */
  readonly status?: string | undefined;
  readonly enabled: boolean;
  /** Sent and awaiting the game: shown in progress, not pressable again. */
  readonly pending?: boolean | undefined;
  readonly testId: string;
  readonly onActivate: () => void;
};

export type CardTableProps = {
  readonly label: string;
  readonly testId: string;
  readonly seats: readonly CardTableSeat[];
  /** What the table is doing now, in words. */
  readonly center: string;
  /**
   * The host already shows `center` beside the table (a game's turn line):
   * the table keeps saying it to a listener but draws it only once.
   */
  readonly centerSpokenOnly?: boolean | undefined;
  /**
   * Tricks are being played: the trick in the middle of the table shows
   * an empty place for each seat yet to play. While cards are chosen or
   * passed nothing is played, and the middle of the table stays quiet.
   */
  readonly trick?: boolean | undefined;
  readonly hand: readonly CardTableHandCard[];
  readonly handLabel: string;
  /** Visible guidance immediately above the hand. */
  readonly handInstruction?: string | undefined;
  readonly cardTestId: (id: string) => string;
  readonly onCard: (id: string) => void;
  readonly action?: CardTableAction | undefined;
  /**
   * While cards are chosen to pass: the middle of the table shows where
   * they go (`Passing left`) and a place for each, filled as they are chosen.
   */
  readonly pass?: CardTablePass | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

/** The pass being chosen: where it goes, how many cards, and those chosen. */
export type CardTablePass = {
  readonly label: string;
  readonly size: number;
  readonly cards: readonly CardTableCard[];
};

const SYMBOLS: Readonly<Record<CardSuit, string>> = {
  clubs: '♣',
  diamonds: '♦',
  spades: '♠',
  hearts: '♥',
};

/**
 * What a card is called: the face as shown (`Q spades`), so a person who says
 * what they see names it, then its full name (`Queen of spades`).
 */
function spokenName(card: CardTableCard): string {
  return `${card.rank} ${card.suitName}, ${card.label}`;
}

/**
 * A card's face as a real card prints it: the rank in the top corner with a
 * small suit pip under it (drawn by the stylesheet, so a listener and a
 * reader of the words meet the suit once) and a large pip in the middle, so
 * a suit is never told by colour alone. The suit's name is in the card's
 * words and its spoken name, not printed on the face: a phone's small card
 * has no room for a name that could be read.
 */
function CardFace(props: { card: CardTableCard }): JSX.Element {
  return (
    <>
      <span class={styles['index']}>{props.card.rank}</span>{' '}
      <span aria-hidden="true" class={styles['suit']}>
        {SYMBOLS[props.card.suit]}
      </span>{' '}
      <span class={styles['spoken']}>{props.card.suitName}</span>
    </>
  );
}

/** A seat's plate at the table's edge: who sits there and its facts. */
function Seat(props: { seat: () => CardTableSeat; trick: boolean }) {
  const seat = () => props.seat();
  return (
    <section
      class={styles['seat']}
      data-trick={String(props.trick)}
      data-player={String(seat().player !== undefined)}
      data-position={seat().position}
      data-active={String(seat().active)}
      data-testid={seat().testId}
      aria-label={seat().name}
      aria-current={seat().active ? 'step' : undefined}
    >
      <Show
        when={seat().player}
        fallback={<span class={styles['name']}>{seat().name}</span>}
      >
        {seat().player}
      </Show>
      <span class={styles['facts']}>
        <Index each={seat().facts}>
          {(fact) => <span class={styles['fact']}>{fact()}</span>}
        </Index>
        <Show when={seat().status}>
          {(status) => (
            <span
              class={
                seat().player === undefined ? styles['fact'] : styles['spoken']
              }
            >
              {status()}
            </span>
          )}
        </Show>
      </span>
    </section>
  );
}

/**
 * The trick in the middle of the table: each seat's card on the side of
 * the table it sits on, an empty place for a seat yet to play, so the
 * table reads as four players around one trick.
 */
function Trick(props: {
  seats: readonly CardTableSeat[];
  trick: boolean;
}): JSX.Element {
  return (
    <div class={styles['trick']} data-trick={String(props.trick)}>
      <Index each={props.seats}>
        {(seat) => (
          <span
            class={styles['slot']}
            data-position={seat().position}
            data-filled={String(seat().played !== null)}
          >
            <Show when={seat().played}>
              {(card) => (
                <span
                  class={styles['card']}
                  data-suit={card().suit}
                  role="img"
                  aria-label={spokenName(card())}
                  data-testid={`${seat().testId}-played`}
                  data-card={card().id}
                >
                  <CardFace card={card()} />
                </span>
              )}
            </Show>
          </span>
        )}
      </Index>
    </div>
  );
}

const MOVES: Readonly<Record<string, (at: number, last: number) => number>> = {
  ArrowRight: (at, last) => Math.min(last, at + 1),
  ArrowDown: (at, last) => Math.min(last, at + 1),
  ArrowLeft: (at) => Math.max(0, at - 1),
  ArrowUp: (at) => Math.max(0, at - 1),
  Home: () => 0,
  End: (_at, last) => last,
};

/**
 * More cards than one row shows at a readable size lie in two rows, the
 * shorter centred under the longer (half a step along when they are
 * equal). Cards never overlap, so every card shows its whole face;
 * thirteen cards on a 390px phone are about 46px wide each.
 */
const ONE_ROW_MAX = 7;

/**
 * How many of a hand's cards lie in its upper row, given each card's suit
 * in order: all of them when one row holds them; else the suit boundary
 * nearest the middle whose two rows both fit, so a suit is read in one
 * row; else the middle (the upper row the longer).
 */
export function handSplit(suits: readonly string[]): number {
  const count = suits.length;
  if (count <= ONE_ROW_MAX) return count;
  const middle = Math.ceil(count / 2);
  const fits = (top: number): boolean =>
    top <= ONE_ROW_MAX && count - top <= ONE_ROW_MAX;
  const boundaries = suits
    .map((_, at) => at)
    .filter((at) => at > 0 && suits[at] !== suits[at - 1] && fits(at))
    .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || b - a);
  return boundaries[0] ?? middle;
}

/** Where a card sits in the hand: its row, and how far along, in steps. */
export function handPlace(
  index: number,
  suits: readonly string[]
): { readonly row: 0 | 1; readonly step: number } {
  const top = handSplit(suits);
  const bottom = suits.length - top;
  const wide = Math.max(top, bottom);
  if (index < top) return { row: 0, step: (wide - top) / 2 + index };
  const along = top === bottom ? 0.5 : (wide - bottom) / 2;
  return { row: 1, step: along + index - top };
}

/** How many steps the furthest card of the hand sits from the first. */
export function handSpan(suits: readonly string[]): number {
  return Math.max(1, ...suits.map((_, at) => handPlace(at, suits).step));
}

/** Where a hand's card sits: its row, and its step along it. */
function handCardStyle(
  index: number,
  suits: readonly string[]
): JSX.CSSProperties {
  const place = handPlace(index, suits);
  return {
    '--hand-row': String(place.row),
    '--hand-step': String(place.step),
  };
}

function HandCardFace(props: { card: CardTableHandCard }): JSX.Element {
  return (
    <>
      <CardFace card={props.card} />
      <Show when={props.card.refusal}>
        <span class={styles['unavailable']} aria-hidden="true">
          ×
        </span>
      </Show>
    </>
  );
}

function createHandFocus(
  ids: () => readonly string[],
  row: () => HTMLDivElement | undefined
) {
  // The one card reached by Tab: the last one the person was on.
  const [current, setCurrent] = createSignal(0);
  const buttons = () =>
    row()?.querySelectorAll<HTMLButtonElement>('button') ?? [];
  const focusAt = (at: number): void => {
    const next = Math.max(0, Math.min(at, ids().length - 1));
    setCurrent(next);
    buttons()[next]?.focus();
  };
  // A played card leaves the hand: focus moves to the card now in its place
  // rather than falling out of the hand, unless it went elsewhere first.
  let played = false;
  createEffect(
    on(
      ids,
      () => {
        const at = Math.min(current(), Math.max(0, ids().length - 1));
        setCurrent(at);
        const active = row()?.ownerDocument.activeElement;
        const lost =
          active === null ||
          active === undefined ||
          active === row()?.ownerDocument.body;
        if (played && lost) buttons()[at]?.focus();
        played = false;
      },
      { defer: true }
    )
  );
  const move = (event: KeyboardEvent, at: number): void => {
    const step = MOVES[event.key];
    if (step === undefined) return;
    event.preventDefault();
    focusAt(step(at, ids().length - 1));
  };
  return {
    current,
    setCurrent,
    move,
    markPlayed: () => {
      played = true;
    },
  };
}

function Hand(
  props: CardTableProps & { readonly onRefused: (reason: string) => void }
): JSX.Element {
  let row: HTMLDivElement | undefined;
  // Cards keyed by id: a change re-renders only the cards that changed.
  const ids = createMemo(() => props.hand.map((card) => card.id));
  const suits = createMemo(() => props.hand.map((card) => card.suit));
  const byId = createMemo(
    () => new Map(props.hand.map((card) => [card.id, card] as const))
  );
  const focus = createHandFocus(ids, () => row);
  return (
    <div
      ref={row}
      class={styles['hand']}
      style={{
        '--hand-span': String(handSpan(suits())),
      }}
      role="toolbar"
      aria-label={props.handLabel}
      data-crowded={String(props.hand.length > ONE_ROW_MAX)}
      data-testid={`${props.testId}-hand`}
    >
      <For each={ids()}>
        {(id, index) => (
          <Show when={byId().get(id)}>
            {(card) => (
              <button
                type="button"
                class={styles['card']}
                style={handCardStyle(index(), suits())}
                data-refused={String(card().refusal !== undefined)}
                data-suit={card().suit}
                data-testid={props.cardTestId(id)}
                data-card={id}
                aria-label={spokenName(card())}
                aria-pressed={card().selected ?? undefined}
                aria-disabled={!card().enabled}
                title={card().refusal}
                tabIndex={index() === focus.current() ? 0 : -1}
                onFocus={() => focus.setCurrent(index())}
                onKeyDown={(event) => focus.move(event, index())}
                onClick={() => {
                  if (card().enabled) {
                    focus.markPlayed();
                    props.onCard(id);
                  } else {
                    const reason = card().refusal;
                    if (reason !== undefined) props.onRefused(reason);
                  }
                }}
              >
                <HandCardFace card={card()} />
              </button>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}

/**
 * While cards are chosen to pass, the middle of the table: where they go,
 * and a place for each, filled with the chosen cards in the order chosen.
 * The hand already says which are chosen, so this is drawn, not spoken.
 */
function PassArea(props: { pass: CardTablePass }): JSX.Element {
  const places = createMemo((): readonly (CardTableCard | null)[] => {
    const cards = props.pass.cards;
    return Array.from(
      { length: props.pass.size },
      (_, at) => cards[at] ?? null
    );
  });
  return (
    <div class={styles['pass']} aria-hidden="true">
      <span class={styles['passLabel']}>{props.pass.label}</span>
      <span class={styles['passPlaces']}>
        <Index each={places()}>
          {(card) => (
            <span class={styles['slot']} data-filled={String(card() !== null)}>
              <Show when={card()}>
                {(shown) => (
                  <span class={styles['card']} data-suit={shown().suit}>
                    <CardFace card={shown()} />
                  </span>
                )}
              </Show>
            </span>
          )}
        </Index>
      </span>
    </div>
  );
}

/**
 * The action under the hand: how far the selection is, in words, beside
 * the button that confirms it. Once sent the button goes quiet and says it
 * is on its way in ink, a status rather than a filled or link-coloured
 * button.
 */
function ActionRow(props: { action: CardTableAction }): JSX.Element {
  const pending = (): boolean => props.action.pending === true;
  return (
    <div class={styles['action']}>
      <p class={styles['actionStatus']} aria-live="polite">
        {props.action.status}
      </p>
      <Button
        title={props.action.label}
        variant={pending() ? 'ghost' : 'solid'}
        intent={pending() ? 'neutral' : undefined}
        disabled={!props.action.enabled}
        loading={pending()}
        loadingLabel={props.action.label}
        onClick={() => {
          if (!pending()) props.action.onActivate();
        }}
        dataSet={{ testid: props.action.testId }}
      />
    </div>
  );
}

/**
 * `CardTable` -- four seats around a card game's shared play, and the
 * viewer's own hand.
 *
 * Each seat is a plate at its edge of the felt: the person sitting there
 * when the host lends them (`player`, a `GameTableSeat`), else the seat's
 * name, then its facts on one quiet line (cards held, score), and whether it
 * is deciding now (`aria-current`; while tricks are played also a strong
 * accent ring, while cards are passed every seat chooses at once and the
 * ring stays off). The middle of the table holds the trick: every seat's
 * card on its own side, an empty place for a seat yet to play; while cards
 * are passed it shows where they go and a place for each card chosen
 * (`pass`). The centre says what the table is doing; a host that already
 * shows that line beside the table keeps it for listeners only
 * (`centerSpokenOnly`). Cards are drawn as cards: the rank and a small pip
 * in the corner and a large pip in the middle, at full contrast; only a card
 * the rules refuse is dimmed. The hand is a row of card buttons side by
 * side, never overlapping, so every face reads whole (more than seven cards
 * lie in two rows that never scroll, each card as wide as the longer row
 * leaves it); a chosen card lifts 8px out of its row with a strong ring. Arrow keys, Home and End move between them, Enter or Space plays or
 * selects a card, and a card the rules do not allow says why instead of
 * acting. Focus stays in the hand when a played card leaves it. Suits are
 * written as symbols and named in each card's words, never told by colour
 * alone. An optional action confirms a selection (passing cards), with how
 * far the selection is beside it, and shows when it is sent.
 *
 * @example
 * ```tsx
 * <CardTable label="Table" testId="t" seats={seats} center="Your lead"
 *   hand={hand} handLabel="Your hand" cardTestId={(id) => `t-card-${id}`}
 *   onCard={play} />
 * ```
 */
export function CardTable(props: CardTableProps): JSX.Element {
  const seatIds = createMemo(() => props.seats.map((seat) => seat.testId));
  const seatsById = createMemo(
    () => new Map(props.seats.map((seat) => [seat.testId, seat]))
  );
  // Why the last card pressed was refused, until the table moves on.
  const [refusal, setRefusal] = createSignal('');
  createEffect(
    on(
      () => props.center,
      () => setRefusal(''),
      { defer: true }
    )
  );
  return (
    <div
      class={styles['root']}
      {...dataAttrs({ component: 'CardTable', ...props.dataSet })}
      data-testid={props.testId}
    >
      <div class={styles['table']} role="group" aria-label={props.label}>
        <For each={seatIds()}>
          {(id) => (
            <Seat
              seat={() => {
                const seat = seatsById().get(id);
                if (!seat) throw new Error('A rendered seat must exist');
                return seat;
              }}
              trick={props.trick === true}
            />
          )}
        </For>
        <Show when={props.seats.length > 0}>
          <Trick seats={props.seats} trick={props.trick === true} />
        </Show>
        <Show when={props.trick !== true && props.pass}>
          {(pass) => <PassArea pass={pass()} />}
        </Show>
        <p
          class={styles['center']}
          data-spoken-only={String(props.centerSpokenOnly === true)}
          aria-live="polite"
          data-testid={`${props.testId}-center`}
        >
          {props.center}
        </p>
      </div>
      <Show when={props.handInstruction}>
        <p class={styles['guidance']}>{props.handInstruction}</p>
      </Show>
      <For
        each={[
          ...new Set(
            props.hand.flatMap((card) => (card.refusal ? [card.refusal] : []))
          ),
        ]}
      >
        {(reason) => <p class={styles['guidance']}>× {reason}</p>}
      </For>
      <Hand {...props} onRefused={setRefusal} />
      <p
        class={styles['refusal']}
        role="status"
        data-testid={`${props.testId}-refusal`}
      >
        {refusal()}
      </p>
      <Show when={props.action}>
        {(action) => <ActionRow action={action()} />}
      </Show>
    </div>
  );
}
