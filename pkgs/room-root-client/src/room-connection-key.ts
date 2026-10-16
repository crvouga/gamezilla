import { type Accessor, createMemo } from 'solid-js';

/** A connection follows its addressing and identity, independent of projected rows. */
export function createRoomConnectionKey<T extends readonly string[]>(
  read: Accessor<T | null>
): Accessor<T | null> {
  return createMemo(read, undefined, {
    equals: (previous, next) =>
      previous === next ||
      (previous !== null &&
        next !== null &&
        previous.length === next.length &&
        previous.every((value, index) => value === next[index])),
  });
}
