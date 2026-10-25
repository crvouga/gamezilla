/** @jsxImportSource solid-js */
/**
 * `CardTable` -- four seats around a card game's shared play, and the
 * viewer's own hand.
 *
 * Each seat shows who sits there, its facts as separate tags (cards held,
 * score), whether it is deciding now and the card it put on the table. The
 * centre says what the table is doing. The hand is a row of card buttons:
 * arrow keys, Home and End move between them, Enter or Space plays or
 * selects a card, and a card the rules do not allow says so instead of
 * acting. Suits are written as symbols and names, never told by colour
 * alone. An optional action confirms a selection (passing cards).
 *
 * @example
 * ```tsx
 * <CardTable label="Table" testId="t" seats={seats} center="Your lead"
 *   hand={hand} handLabel="Your hand" cardTestId={(id) => `t-card-${id}`}
 *   onCard={play} />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, For, Index, type JSX, Show } from 'solid-js';
import { Button } from './button';
import styles from './card-table.module.css';

export type CardSuit = 'clubs' | 'diamonds' | 'spades' | 'hearts';
export type CardTablePosition = 'bottom' | 'left' | 'top' | 'right';

/** A face-up card: its rank, its suit, and its full name for listeners. */
export type CardTableCard = {
  readonly id: string;
  readonly rank: string;
  readonly suit: CardSuit;
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
  readonly selected: boolean;
};

export type CardTableAction = {
  readonly label: string;
  readonly enabled: boolean;
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
  return `${card.rank} ${card.suit}, ${card.label}`;
}

/** A card's face: rank above its suit symbol, the suit's name for the eye too. */
function CardFace(props: { card: CardTableCard }): JSX.Element {
  return (
    <>
      <span>{props.card.rank}</span>{' '}
      <span aria-hidden="true" class={styles['suit']}>
        {SYMBOLS[props.card.suit]}
      </span>{' '}
      <span class={styles['suitName']}>{props.card.suit}</span>
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

function Hand(props: CardTableProps): JSX.Element {
  let row: HTMLDivElement | undefined;
  // Cards keyed by id: a change re-renders only the cards that changed.
  const ids = createMemo(() => props.hand.map((card) => card.id));
  const byId = createMemo(
    () => new Map(props.hand.map((card) => [card.id, card] as const))
  );
  const move = (event: KeyboardEvent, at: number): void => {
    const step = MOVES[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = step(at, props.hand.length - 1);
    row?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
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
        {(id, index) => {
          const card = () => byId().get(id)!;
          return (
            <button
              type="button"
              class={styles['card']}
              data-testid={props.cardTestId(id)}
              data-card={id}
              aria-label={spokenName(card())}
              aria-pressed={card().selected}
              aria-disabled={!card().enabled}
              tabIndex={index() === 0 ? 0 : -1}
              onKeyDown={(event) => move(event, index())}
              onClick={() => {
                if (card().enabled) props.onCard(id);
              }}
            >
              <CardFace card={card()} />
            </button>
          );
        }}
      </For>
    </div>
  );
}

export function CardTable(props: CardTableProps): JSX.Element {
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
      <Hand {...props} />
      <Show when={props.action}>
        {(action) => (
          <Button
            title={action().label}
            variant="solid"
            disabled={!action().enabled}
            onClick={action().onActivate}
            dataSet={{ testid: action().testId }}
          />
        )}
      </Show>
    </div>
  );
}
