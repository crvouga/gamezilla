import { type Accessor, createMemo, mergeProps } from 'solid-js';
import type { FramePlaySeat, FrameTable } from './game-frame-view-types';

/** Plain data compared by value; a function (a seat's press) by identity. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(
    (key) => Object.hasOwn(right, key) && sameValue(left[key], right[key])
  );
}

/** Whether a seat reads the same: same holder, figure, state and marks. */
export function sameSeat(a: FramePlaySeat, b: FramePlaySeat): boolean {
  return sameValue(a, b);
}

/**
 * The table with each seat kept as the very same object while nothing in
 * it changed. A position read builds every seat afresh, and a game played
 * in real time reads a new position many times a second: without this
 * every player's strip, avatar and figure would be rebuilt on every tick.
 */
export function stableFrameTable(
  table: Accessor<FrameTable>
): Accessor<FrameTable> {
  let previous = new Map<string, FramePlaySeat>();
  return createMemo(() => {
    const next = table();
    const kept = new Map<string, FramePlaySeat>();
    const keep = (seat: FramePlaySeat): FramePlaySeat => {
      const before = previous.get(seat.side);
      const chosen =
        before !== undefined && sameSeat(before, seat) ? before : seat;
      kept.set(seat.side, chosen);
      return chosen;
    };
    const near = next.near === null ? null : keep(next.near);
    const others = next.others.map(keep);
    previous = kept;
    return { ...next, near, others };
  });
}

/** Props whose `table` keeps each unchanged seat as the same object. */
export function withStableTable<P extends { readonly table: FrameTable }>(
  props: P
): P {
  const table = stableFrameTable(() => props.table);
  return mergeProps(props, {
    get table() {
      return table();
    },
  }) as P;
}
