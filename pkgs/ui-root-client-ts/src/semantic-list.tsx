/** @jsxImportSource solid-js */
/**
 * `UnorderedList` / `OrderedList` / `ListEntry` -- list meaning for
 * arbitrary content: "these are N items, and here is each one". Like the
 * landmarks they render with `display: contents`: no box, no bullet, no
 * number. The items lay out in the nearest layout ancestor, so the stack
 * goes **outside** the list and each entry holds one item.
 *
 * This is not the row list: `List` / `ListItem` (`./list`) and `MenuList`
 * draw a panel of rows with hairlines. Use those for rows; use these when
 * the items are your own composition (tiles, chips, cards in a grid).
 *
 * @example
 * ```tsx
 * <StackVertical gap="sm">
 *   <UnorderedList aria-label={t`Open games`}>
 *     <For each={games()}>
 *       {(game) => (
 *         <ListEntry>
 *           <GameTile game={game} />
 *         </ListEntry>
 *       )}
 *     </For>
 *   </UnorderedList>
 * </StackVertical>
 * ```
 */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type SemanticListProps = {
  /** `ListEntry` children only. */
  children?: JSX.Element | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

export type ListEntryProps = {
  children?: JSX.Element | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/** Items whose order carries no meaning. */
export function UnorderedList(props: SemanticListProps): JSX.Element {
  return (
    <ul
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('UnorderedList')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </ul>
  );
}

/** Items in a meaningful order: steps, a ranking, moves. */
export function OrderedList(
  props: SemanticListProps & {
    /** The first item's number, when the list shows the later part of a longer one. */
    start?: number | undefined;
  }
): JSX.Element {
  return (
    <ol
      class="contents"
      start={props.start}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('OrderedList')}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
    >
      {props.children}
    </ol>
  );
}

/** One item of an `UnorderedList` or `OrderedList`. */
export function ListEntry(props: ListEntryProps): JSX.Element {
  return (
    <li
      class="contents"
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('ListEntry')}
    >
      {props.children}
    </li>
  );
}
