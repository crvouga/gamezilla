import { RULESET } from './word-tiles-ruleset';
import { TILE_COUNT, TILES } from './word-tiles-tiles';

/**
 * The authority's hidden state: the bag in draw order, every rack, the
 * tiles already on the board, and the random state later reshuffles use.
 * Only the authority holds it; each seat is shown its own rack
 * (`handOf`) and nothing else. Every physical tile is in exactly one place
 * — the bag, one rack or the board — which `decodeHidden` refuses to
 * violate.
 *
 * The deal draws four numbers from the authority's random source — a
 * 128-bit seed, too many to search from the tiles a seat can see — and
 * expands them with xoshiro128**, whose state the hidden state keeps, so a
 * stored hidden state reproduces every later reshuffle. The seed, the
 * generator state and the bag order never leave the authority.
 */
export type RandomState = readonly [number, number, number, number];

export type HiddenState = {
  readonly bag: readonly number[];
  readonly racks: readonly (readonly number[])[];
  readonly board: readonly number[];
  /** The generator state (four 32-bit words). */
  readonly rng: RandomState;
};

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** One step of xoshiro128**: a value in [0, 1) and the next state. */
export function nextRandom(state: RandomState): {
  readonly value: number;
  readonly state: RandomState;
} {
  let [a, b, c, d] = state;
  const result = Math.imul(rotl(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
  const t = (b << 9) >>> 0;
  c = (c ^ a) >>> 0;
  d = (d ^ b) >>> 0;
  b = (b ^ c) >>> 0;
  a = (a ^ d) >>> 0;
  c = (c ^ t) >>> 0;
  d = rotl(d, 11);
  return { value: result / 4_294_967_296, state: [a, b, c, d] };
}

/** A Fisher–Yates shuffle of `ids` driven by the generator at `state`. */
export function shuffled(
  ids: readonly number[],
  state: RandomState
): { readonly ids: readonly number[]; readonly state: RandomState } {
  const out = [...ids];
  let rng = state;
  for (let i = out.length - 1; i > 0; i--) {
    const step = nextRandom(rng);
    rng = step.state;
    const j = Math.floor(step.value * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return { ids: out, state: rng };
}

/** The 128-bit seed four draws of the authority's random source give. */
export function seedFrom(random: () => number): RandomState {
  const word = () => Math.floor(random() * 4_294_967_296) >>> 0;
  const seed: [number, number, number, number] = [
    word(),
    word(),
    word(),
    word(),
  ];
  // The all-zero state is the generator's one fixed point.
  if (seed.every((w) => w === 0)) seed[3] = 1;
  return seed;
}

/** A new game's hidden state: the bag shuffled, seven tiles to each seat in turn. */
export function dealHidden(seats: number, seed: RandomState): HiddenState {
  const { ids, state } = shuffled(
    TILES.map((tile) => tile.id),
    seed
  );
  const racks: number[][] = [];
  for (let seat = 0; seat < seats; seat++)
    racks.push(
      ids.slice(seat * RULESET.rackSize, (seat + 1) * RULESET.rackSize)
    );
  return {
    bag: ids.slice(seats * RULESET.rackSize),
    racks,
    board: [],
    rng: state,
  };
}

/** `seat`'s own rack: the only part of the hidden state shown to it. */
export function handOf(hidden: HiddenState, seat: number): string {
  return (hidden.racks[seat] ?? []).join(',');
}

/** The tile ids a hand view lists, or `null` when it is malformed. */
export function parseHand(hand: string): readonly number[] | null {
  if (hand === '') return [];
  const ids = hand.split(',');
  if (ids.length > RULESET.rackSize || !ids.every((id) => /^\d{1,2}$/.test(id)))
    return null;
  const parsed = ids.map(Number);
  return parsed.every((id) => id < TILE_COUNT) &&
    new Set(parsed).size === parsed.length
    ? parsed
    : null;
}

export function encodeHidden(hidden: HiddenState): string {
  return JSON.stringify({
    v: 1,
    bag: hidden.bag,
    racks: hidden.racks,
    board: hidden.board,
    rng: hidden.rng,
  });
}

function ids(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (id: unknown) =>
        typeof id === 'number' &&
        Number.isInteger(id) &&
        id >= 0 &&
        id < TILE_COUNT
    )
  );
}

function validState(value: unknown): value is RandomState {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(
      (w: unknown) =>
        typeof w === 'number' &&
        Number.isInteger(w) &&
        w >= 0 &&
        w <= 0xffffffff
    ) &&
    value.some((w) => w !== 0)
  );
}

/** Whether every physical tile is in exactly one of bag, racks and board. */
export function conserves(hidden: HiddenState): boolean {
  const all = [...hidden.bag, ...hidden.racks.flat(), ...hidden.board];
  return all.length === TILE_COUNT && new Set(all).size === TILE_COUNT;
}

/** The hidden state `text` writes, or `null` when it is malformed or loses a tile. */
export function decodeHidden(text: string, seats: number): HiddenState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { v, bag, racks, board, rng } = raw as Record<string, unknown>;
  if (v !== 1 || !ids(bag) || !ids(board)) return null;
  if (!Array.isArray(racks) || racks.length !== seats) return null;
  if (!racks.every((rack) => ids(rack) && rack.length <= RULESET.rackSize))
    return null;
  if (!validState(rng)) return null;
  const hidden: HiddenState = {
    bag,
    racks: racks as readonly (readonly number[])[],
    board,
    rng,
  };
  return conserves(hidden) ? hidden : null;
}

/** Take up to `count` tiles from the front of the bag into `seat`'s rack. */
export function drawInto(
  hidden: HiddenState,
  seat: number,
  count: number
): HiddenState {
  const drawn = hidden.bag.slice(0, count);
  return {
    ...hidden,
    bag: hidden.bag.slice(drawn.length),
    racks: hidden.racks.map((rack, s) =>
      s === seat ? [...rack, ...drawn] : rack
    ),
  };
}

/** `seat`'s rack without `tiles` (placed on the board or returned to the bag). */
export function takeFromRack(
  hidden: HiddenState,
  seat: number,
  tiles: readonly number[]
): HiddenState {
  const removed = new Set(tiles);
  return {
    ...hidden,
    racks: hidden.racks.map((rack, s) =>
      s === seat ? rack.filter((id) => !removed.has(id)) : rack
    ),
  };
}

/**
 * An exchange: replacements are drawn from the bag as it was, then the
 * returned tiles go back and the bag is reshuffled — one operation.
 */
export function exchangeTiles(
  hidden: HiddenState,
  seat: number,
  tiles: readonly number[]
): HiddenState {
  const drawn = drawInto(takeFromRack(hidden, seat, tiles), seat, tiles.length);
  const bag = shuffled([...drawn.bag, ...tiles], drawn.rng);
  return { ...drawn, bag: bag.ids, rng: bag.state };
}
