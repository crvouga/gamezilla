/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, For, type JSX, Show } from 'solid-js';
import { Badge } from '../badge/index';

export type SuggestionItem = {
  /** Stable id, handed back to `onPick`. */
  readonly key: string;
  readonly label: string;
  /** Short kind shown as a badge at the end (`table`, `column`). */
  readonly detail?: string | undefined;
};

export type SuggestionListProps = {
  items: readonly SuggestionItem[];
  /** Index of the highlighted row. */
  highlighted: number;
  onPick: (key: string) => void;
  onHighlight?: ((index: number) => void) | undefined;
  'aria-label': string;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

function SuggestionRow(props: {
  id: string;
  item: SuggestionItem;
  highlighted: boolean;
  onPick: () => void;
  onHover: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="option"
      id={props.id}
      tabIndex={-1}
      aria-selected={props.highlighted}
      class="clickable clickableTint flex-row items-center gap-ui-sm px-ui-sm py-ui-xs text-start"
      classList={{ 'bg-tint-subtle': props.highlighted }}
      onPointerDown={(event) => event.preventDefault()}
      onPointerEnter={() => props.onHover()}
      onClick={() => props.onPick()}
    >
      <code class="text textMono flex-1 min-w-0 truncate">
        {props.item.label}
      </code>
      <Show when={props.item.detail}>
        {(detail) => <Badge label={detail()} intent="neutral" size="sm" />}
      </Show>
    </button>
  );
}

/**
 * `SuggestionList` -- completions for the field above it (identifiers in a
 * code editor, names in a search box): one hairline panel of dense rows, at
 * most about six rows tall, each a mono label with an optional kind badge.
 *
 * The field keeps the keyboard: arrow keys move `highlighted` in the
 * caller, which also accepts the highlighted row on Enter or Tab. A pointer
 * moves the highlight (`onHighlight`) and a press picks the row
 * (`onPick`) without taking focus from the field.
 *
 * @example
 * ```tsx
 * <SuggestionList
 *   aria-label={t`Completions`}
 *   items={candidates().map((c) => ({ key: c.label, label: c.label, detail: c.kind }))}
 *   highlighted={index()}
 *   onHighlight={setIndex}
 *   onPick={(key) => insert(key)}
 * />
 * ```
 */
export function SuggestionList(props: SuggestionListProps): JSX.Element {
  const id = createUniqueId();
  return (
    <div
      class="box border border-border rounded-control bg-surface max-h-48 overflow-y-auto overscroll-contain"
      role="listbox"
      aria-label={props['aria-label']}
      data-testid={props.testId}
      data-component={componentId('SuggestionList')}
    >
      <For each={props.items}>
        {(item, index) => (
          <SuggestionRow
            id={`${id}-${index()}`}
            item={item}
            highlighted={props.highlighted === index()}
            onPick={() => props.onPick(item.key)}
            onHover={() => props.onHighlight?.(index())}
          />
        )}
      </For>
    </div>
  );
}
