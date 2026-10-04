/** @jsxImportSource solid-js */
/**
 * `List` / `ListItem` -- structured list with leading, trailing, and separator support.
 *
 * `List` renders a `<ul>`; every resolved child is wrapped in an `<li>` with
 * an optional hairline separator. `ListItem` becomes a clickable `<button>`
 * when `onClick` is set so hover / press feedback and keyboard focus come for
 * free. Pass `selected` to render the row with a `tintSubtle` fill.
 *
 * @example
 * ```tsx
 * <List>
 *   <ListItem title="Profile" subtitle="Edit your info" onClick={goProfile} />
 *   <ListItem title="Settings" trailing={<ChevronRightIcon />} onClick={goSettings} />
 * </List>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import {
  createMemo,
  For,
  type JSX,
  children as resolveChildren,
  Show,
} from 'solid-js';

export type ListProps = {
  children: JSX.Element;
  /** Show hairline separators between items. Defaults to true. */
  separator?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function List(props: ListProps): JSX.Element {
  const resolved = resolveChildren(() => props.children);
  const items = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  const separator = () => props.separator ?? true;
  return (
    <ul class="box" {...dataAttrs({ component: 'List', ...props.dataSet })}>
      <For each={items()}>
        {(child, index) => (
          <li class="box">
            {child}
            <Show when={separator() && index() < items().length - 1}>
              <div class="box border-b border-border ml-4" aria-hidden="true" />
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

export type ListItemProps = {
  title: JSX.Element;
  subtitle?: JSX.Element | undefined;
  /** Rendered at the start (left). */
  leading?: JSX.Element | undefined;
  /** Rendered at the end (right). */
  trailing?: JSX.Element | undefined;
  /** Render with a `tintSubtle` background to indicate current selection. */
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function ListItemContent(props: {
  title: JSX.Element;
  subtitle: JSX.Element | undefined;
  leading: JSX.Element | undefined;
  trailing: JSX.Element | undefined;
}): JSX.Element {
  return (
    <div class="box flex-row items-center py-3 px-4 gap-3 min-h-11">
      {props.leading}
      <div class="box flex-1 min-w-0 items-start">
        <p class="text text-text">{props.title}</p>
        <Show when={props.subtitle}>
          <p class="text textCaption text-text-secondary">{props.subtitle}</p>
        </Show>
      </div>
      {props.trailing}
    </div>
  );
}

function selectedClass(selected: boolean): string {
  return selected ? 'bg-tint-subtle rounded-control' : '';
}

export function ListItem(props: ListItemProps): JSX.Element {
  const content = (): JSX.Element => (
    <ListItemContent
      title={props.title}
      subtitle={props.subtitle}
      leading={props.leading}
      trailing={props.trailing}
    />
  );
  return (
    <Show
      when={props.onClick}
      fallback={
        <div
          class={`box ${selectedClass(props.selected === true)}`}
          {...dataAttrs({ component: 'ListItem', ...props.dataSet })}
          aria-selected={props.selected === true ? true : undefined}
        >
          {content()}
        </div>
      }
    >
      {(onClick) => (
        <button
          class={`clickable clickableTint items-stretch w-full ${selectedClass(props.selected === true)}`}
          {...dataAttrs({ component: 'ListItem', ...props.dataSet })}
          type="button"
          onClick={() => onClick()()}
          aria-pressed={props.selected === true ? true : undefined}
        >
          {content()}
        </button>
      )}
    </Show>
  );
}
