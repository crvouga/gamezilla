/** @jsxImportSource solid-js */
/**
 * Sample tables for the game frame examples: up to eight seats of people,
 * bots, guests and open seats, with long names to exercise truncation.
 * Illustrative only; no game or product dependency.
 */

import {
  AVATAR_SEAT_COLORS,
  Avatar,
  type AvatarKind,
} from '@pkgs/ui-root-client-ts/avatar';
import type { GameSeatLook } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import type { JSX } from 'solid-js';

export type ExampleSeat = {
  id: string;
  name: string;
  kind: AvatarKind;
  look: GameSeatLook;
  score: string;
};

const MARKS = ['●', '◆', '▲', '■', '★', '✚', 'X', 'O'] as const;

const PEOPLE: readonly { name: string; kind: AvatarKind }[] = [
  { name: 'Erin', kind: 'person' },
  { name: 'Stockfish', kind: 'bot' },
  { name: 'Guest 4821', kind: 'guest' },
  { name: 'Open seat', kind: 'emptySeat' },
  { name: 'Maximilian Featherstonehaugh', kind: 'person' },
  { name: 'Robin', kind: 'person' },
  { name: 'Pebble', kind: 'bot' },
  { name: 'Alexandria Montgomery-Smith', kind: 'person' },
];

function seatAt(
  person: { name: string; kind: AvatarKind },
  index: number
): ExampleSeat {
  return {
    id: `seat-${index + 1}`,
    name: person.name,
    kind: person.kind,
    look: { color: AVATAR_SEAT_COLORS[index] ?? 'player1', mark: MARKS[index] },
    score: String(40 - index * 5),
  };
}

/** The first `count` seats (1–8), each with its own color and mark. */
export function exampleSeats(count: number): readonly ExampleSeat[] {
  return PEOPLE.slice(0, count).map(seatAt);
}

/** Seat `index` (0–7) of the full table. */
export function exampleSeat(index: number): ExampleSeat {
  return seatAt(PEOPLE[index] ?? { name: 'Erin', kind: 'person' }, index);
}

/** The seat's avatar at `size`. */
export function exampleAvatar(seat: ExampleSeat, size: number): JSX.Element {
  return <Avatar kind={seat.kind} alt={seat.name} size={size} />;
}
