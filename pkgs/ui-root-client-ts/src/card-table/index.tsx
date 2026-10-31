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
  readonly hand: readonly CardTableHandCard[];
  readonly handLabel: string;
  readonly cardTestId: (id: string) => string;
  readonly onCard: (id: string) => void;
  readonly action?: CardTableAction | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
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

/** A card's face: rank above its suit symbol, the suit's name for the eye too. */
function CardFace(props: { card: CardTableCard }): JSX.Element {
  return (
    <>
      <span>{props.card.rank}</span>{' '}
      <span aria-hidden="true" class={styles['suit']}>
        {SYMBOLS[props.card.suit]}
      </span>{' '}
      <span class={styles['suitName']}>{props.card.suitName}</span>
    </>
  );
}

function Seat(props: { seat: () => CardTableSeat }) {
  const seat = () => props.seat();
  return (
    <section
      class={styles['seat']}
      data-position={seat().position}
      data-active={String(seat().active)}
      data-testid={seat().testId}
      aria-label={seat().name}
      aria-current={seat().active ? 'step' : undefined}
    >
      <span class={styles['name']}>{seat().name}</span>
      <span class={styles['facts']}>
        <Index each={seat().facts}>
          {(fact) => <span class={styles['fact']}>{fact()}</span>}
        </Index>
      </span>
      <span class={styles['played']}>
        <Show when={seat().played}>
          {(card) => (
            <span
              class={styles['card']}
              data-suit={props.seat().played?.suit}
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
    </section>
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

function Hand(
  props: CardTableProps & { readonly onRefused: (reason: string) => void }
): JSX.Element {
  let row: HTMLDivElement | undefined;
  // Cards keyed by id: a change re-renders only the cards that changed.
  const ids = createMemo(() => props.hand.map((card) => card.id));
  const byId = createMemo(
    () => new Map(props.hand.map((card) => [card.id, card] as const))
  );
  // The one card reached by Tab: the last one the person was on.
  const [current, setCurrent] = createSignal(0);
  const buttons = () =>
    row?.querySelectorAll<HTMLButtonElement>('button') ?? [];
  const focusAt = (at: number): void => {
    const next = Math.max(0, Math.min(at, props.hand.length - 1));
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
        const at = Math.min(current(), Math.max(0, props.hand.length - 1));
        setCurrent(at);
        const active = row?.ownerDocument.activeElement;
        const lost =
          active === null ||
          active === undefined ||
          active === row?.ownerDocument.body;
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
    focusAt(step(at, props.hand.length - 1));
  };
  return (
    <div
      ref={row}
      class={styles['hand']}
      role="toolbar"
      aria-label={props.handLabel}
      data-testid={`${props.testId}-hand`}
    >
      <For each={ids()}>
        {(id, index) => (
          <Show when={byId().get(id)}>
            {(card) => (
              <button
                type="button"
                class={styles['card']}
                data-suit={card().suit}
                data-testid={props.cardTestId(id)}
                data-card={id}
                aria-label={spokenName(card())}
                aria-pressed={card().selected ?? undefined}
                aria-disabled={!card().enabled}
                tabIndex={index() === current() ? 0 : -1}
                onFocus={() => setCurrent(index())}
                onKeyDown={(event) => move(event, index())}
                onClick={() => {
                  if (card().enabled) {
                    played = true;
                    props.onCard(id);
                  } else {
                    const reason = card().refusal;
                    if (reason !== undefined) props.onRefused(reason);
                  }
                }}
              >
                <CardFace card={card()} />
              </button>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}

/**
 * `CardTable` -- four seats around a card game's shared play, and the
 * viewer's own hand.
 *
 * Each seat shows who sits there, its facts as separate tags (cards held,
 * score), whether it is deciding now and the card it put on the table. The
 * centre says what the table is doing. The hand is a row of card buttons:
 * arrow keys, Home and End move between them, Enter or Space plays or
 * selects a card, and a card the rules do not allow says why instead of
 * acting. Focus stays in the hand when a played card leaves it. Suits are
 * written as symbols and names, never told by colour alone. An optional
 * action confirms a selection (passing cards) and shows when it is sent.
 *
 * @example
 * ```tsx
 * <CardTable label="Table" testId="t" seats={seats} center="Your lead"
 *   hand={hand} handLabel="Your hand" cardTestId={(id) => `t-card-${id}`}
 *   onCard={play} />
 * ```
 */
export function CardTable(props: CardTableProps): JSX.Element {
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
      {...dataAttrs({ component: 'CardTable', ...props.dataSet })}
      data-testid={props.testId}
    >
      <div class={styles['table']} role="group" aria-label={props.label}>
        <Index each={props.seats}>{(seat) => <Seat seat={seat} />}</Index>
        <p
          class={styles['center']}
          aria-live="polite"
          data-testid={`${props.testId}-center`}
        >
          {props.center}
        </p>
      </div>
      <Hand {...props} onRefused={setRefusal} />
      <p
        class={styles['refusal']}
        role="status"
        data-testid={`${props.testId}-refusal`}
      >
        {refusal()}
      </p>
      <Show when={props.action}>
        {(action) => (
          <Button
            title={action().label}
            variant="solid"
            disabled={!action().enabled}
            loading={action().pending === true}
            onClick={() => {
              if (action().pending !== true) action().onActivate();
            }}
            dataSet={{ testid: action().testId }}
          />
        )}
      </Show>
    </div>
  );
}
