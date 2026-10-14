import { type Accessor, children, createMemo, type JSX } from 'solid-js';

/** Resolve lazy Solid children once and distinguish actual content from empty branches. */
export function createScreenSlot(read: Accessor<JSX.Element>) {
  const content = children(read);
  const present = createMemo(() =>
    content
      .toArray()
      .some(
        (node) =>
          node !== null &&
          node !== undefined &&
          typeof node !== 'boolean' &&
          node !== ''
      )
  );
  return { content, present };
}
