/** @jsxImportSource solid-js */

import {
  CardTable,
  type CardTableCard,
  type CardTableHandCard,
} from '@pkgs/ui-root-client-ts/card-table';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const card = (
  id: string,
  rank: string,
  suit: CardTableCard['suit'],
  label: string
): CardTableCard => ({ id, rank, suit, suitName: suit, label });

const HAND: readonly CardTableCard[] = [
  card('2C', '2', 'clubs', 'Two of clubs'),
  card('9D', '9', 'diamonds', 'Nine of diamonds'),
  card('QS', 'Q', 'spades', 'Queen of spades'),
  card('AS', 'A', 'spades', 'Ace of spades'),
  card('5H', '5', 'hearts', 'Five of hearts'),
  card('KH', 'K', 'hearts', 'King of hearts'),
];

/** Selecting three cards, then confirming them, and a table mid-trick. */
export default function CardTableExample(): JSX.Element {
  return (
    <ExampleRoot>
      <PassingTable />
      <PlayingTable />
    </ExampleRoot>
  );
}

/** Choosing three cards, a card the rules refuse, then a pass sent and awaited. */
function PassingTable(): JSX.Element {
  const [selected, setSelected] = createSignal<readonly string[]>([]);
  const [sent, setSent] = createSignal(false);
  const toggle = (id: string): void => {
    setSelected((now) =>
      now.includes(id) ? now.filter((s) => s !== id) : [...now, id].slice(-3)
    );
  };
  const hand = (): readonly CardTableHandCard[] =>
    HAND.map((c) => ({
      ...c,
      enabled: c.id !== '2C' && !sent(),
      selected: selected().includes(c.id),
      refusal: c.id === '2C' ? 'You keep the two of clubs.' : undefined,
    }));
  return (
    <CardTable
      label="Card table"
      testId="example-card-table"
      center="Choose three cards to pass"
      seats={[
        {
          position: 'top',
          name: 'North',
          facts: ['13 cards', '12 points', 'Chose'],
          active: false,
          played: null,
          testId: 'example-seat-top',
        },
        {
          position: 'left',
          name: 'West',
          facts: ['13 cards', '0 points'],
          active: true,
          played: card('JC', 'J', 'clubs', 'Jack of clubs'),
          testId: 'example-seat-left',
        },
        {
          position: 'right',
          name: 'East',
          facts: ['13 cards', '26 points'],
          active: false,
          played: null,
          testId: 'example-seat-right',
        },
        {
          position: 'bottom',
          name: 'South (you)',
          facts: ['13 cards', '3 points'],
          active: true,
          played: null,
          testId: 'example-seat-bottom',
        },
      ]}
      hand={hand()}
      handLabel="Your hand"
      cardTestId={(id) => `example-card-${id}`}
      onCard={toggle}
      action={{
        label: 'Pass these three cards',
        enabled: selected().length === 3,
        pending: sent(),
        testId: 'example-pass',
        onActivate: () => setSent(true),
      }}
    />
  );
}

/** Playing a card at once: it leaves the hand, and a card the rules refuse says why. */
function PlayingTable(): JSX.Element {
  const [played, setPlayed] = createSignal<readonly string[]>([]);
  const hand = (): readonly CardTableHandCard[] =>
    HAND.filter((c) => !played().includes(c.id)).map((c) => ({
      ...c,
      enabled: c.suit === 'spades',
      selected: null,
      refusal:
        c.suit === 'spades' ? undefined : 'You must follow suit with a spade.',
    }));
  return (
    <CardTable
      label="Card table, playing"
      testId="example-play-table"
      center={`Spades led. ${String(played().length)} played.`}
      seats={[]}
      hand={hand()}
      handLabel="Your hand"
      cardTestId={(id) => `example-play-card-${id}`}
      onCard={(id) => setPlayed((now) => [...now, id])}
    />
  );
}
