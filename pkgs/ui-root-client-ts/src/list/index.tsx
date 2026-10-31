/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
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

/**
 * `List` / `ListItem` -- structured list with leading, trailing, and separator support.
 *
 * `List` renders a `<ul>` panel (the same raised `.panel` as `MenuList`);
 * every resolved child is wrapped in an `<li>`, with hairlines between items
 * that start at the item's text column. A `ListItem` is at least 56px tall;
 * its title is one line and its subtitle two, each ending in an ellipsis.
 * It becomes a clickable `<button>` when `onClick` is set so hover / press
 * feedback and keyboard focus come for free. Pass `selected` to render the
 * row with a `tintSubtle` fill.
 *
 * @example
 * ```tsx
 * <List>
 *   <ListItem title="Profile" subtitle="Edit your info" onClick={goProfile} />
 *   <ListItem title="Settings" trailing={<ChevronRightIcon />} onClick={goSettings} />
 * </List>
 * ```
 */
export function List(props: ListProps): JSX.Element {
  const resolved = resolveChildren(() => props.children);
  const items = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  return (
    <ul
      class="panel m-0 p-0 list-none"
      classList={{ panelPlain: props.separator === false }}
      {...dataAttrs({ component: 'List', ...props.dataSet })}
    >
      <For each={items()}>{(child) => <li class="panelItem">{child}</li>}</For>
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
    <div class="box flex-row items-stretch pl-4 min-h-14">
      <Show when={props.leading}>
        <div class="box items-center justify-center shrink-0 py-3 pr-3">
          {props.leading}
        </div>
      </Show>
      {/* The text column draws the hairline above the item (`.panelRule`). */}
      <div class="panelRule box flex-1 min-w-0 flex-row items-center gap-3 py-3 pr-4">
        <div class="box flex-1 min-w-0 items-start">
          <p class="text textLabel line-clamp-1 max-w-full">{props.title}</p>
          <Show when={props.subtitle}>
            <p class="text textCaption line-clamp-2 max-w-full">
              {props.subtitle}
            </p>
          </Show>
        </div>
        {props.trailing}
      </div>
    </div>
  );
}

function selectedClass(selected: boolean): string {
  return selected ? 'bg-tint-subtle' : '';
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
