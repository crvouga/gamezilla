/** @jsxImportSource solid-js */
/**
 * `List` / `ListItem` -- structured list with leading, trailing, and separator support.
 *
 * `List` renders a `<ul>`; every resolved child is wrapped in an `<li>` with
 * an optional hairline separator. `ListItem` becomes a `Clickable` when
 * `onClick` is set so hover / press feedback and keyboard focus come for free.
 * Pass `selected` to render the row with a `tintSubtle` fill.
 *
 * @example
 * ```tsx
 * <List>
 *   <ListItem title="Profile" subtitle="Edit your info" onClick={goProfile} />
 *   <ListItem title="Settings" trailing={<ChevronRightIcon />} onClick={goSettings} />
 * </List>
 * ```
 */

import {
  createMemo,
  For,
  type JSX,
  children as resolveChildren,
  Show,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box, joinClass } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

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
    <Box as="ul" dataSet={{ component: 'List', ...props.dataSet }}>
      <For each={items()}>
        {(child, index) => (
          <Box as="li">
            {child}
            <Show when={separator() && index() < items().length - 1}>
              <Box aria-hidden="true" class="border-b border-border ml-4" />
            </Show>
          </Box>
        )}
      </For>
    </Box>
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
    <Box class="flex-row items-center py-3 px-4 gap-3 min-h-[44px]">
      {props.leading}
      <Box class="flex-1 min-w-0 items-start">
        <Text label={props.title} />
        <Show when={props.subtitle}>
          <Text variant="caption" label={props.subtitle} />
        </Show>
      </Box>
      {props.trailing}
    </Box>
  );
}

function selectedClass(selected: boolean): string | undefined {
  return selected ? 'bg-tint-subtle rounded-[10px]' : undefined;
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
        <Box
          aria-selected={props.selected === true ? true : undefined}
          class={selectedClass(props.selected === true)}
          dataSet={{ component: 'ListItem', ...props.dataSet }}
        >
          {content()}
        </Box>
      }
    >
      {(onClick) => (
        <Clickable
          onClick={() => onClick()()}
          aria-pressed={props.selected === true ? true : undefined}
          class={joinClass(
            'items-stretch w-full',
            selectedClass(props.selected === true)
          )}
          dataSet={{ component: 'ListItem', ...props.dataSet }}
        >
          {content()}
        </Clickable>
      )}
    </Show>
  );
}
