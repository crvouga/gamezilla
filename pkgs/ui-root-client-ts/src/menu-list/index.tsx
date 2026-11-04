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

export type MenuListProps = {
  children: JSX.Element;
  /** Claim the leftover height of a flex column (a screen body). */
  grow?: boolean | undefined;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean | undefined;
  /**
   * `panel` (default): one surface of rows. `cards`: every row is its own
   * card in a two-column grid — for collections of things on wide layouts.
   */
  layout?: 'panel' | 'cards' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `MenuList` -- a panel of {@link MenuRow}s (`role="group"`).
 *
 * One surface with the panel radius, hairlines between rows inset to the
 * text column (`.panel` / `.panelItem` in `hosts.css`). It sits inside the
 * screen's edge padding like every other block, so a list lines up with the
 * copy around it. `grow` lets the panel claim a screen body's leftover
 * height.
 *
 * @example
 * ```tsx
 * <MenuList>
 *   <MenuRow title="Account" onClick={goAccount} />
 *   <MenuRow title="Appearance" onClick={goTheme} />
 * </MenuList>
 * ```
 */
export function MenuList(props: MenuListProps): JSX.Element {
  const resolved = resolveChildren(() => props.children);
  const rows = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  return (
    <Show
      when={props.layout === 'cards'}
      fallback={
        <div
          class="panel"
          classList={{
            panelPlain: props.separator === false,
            'flex-1': props.grow === true,
          }}
          {...dataAttrs({ component: 'MenuList', ...props.dataSet })}
          role="group"
        >
          <For each={rows()}>
            {(child) => <div class="panelItem">{child}</div>}
          </For>
        </div>
      }
    >
      <div
        class="grid grid-cols-2 gap-3"
        {...dataAttrs({
          component: 'MenuList',
          layout: 'cards',
          ...props.dataSet,
        })}
        role="group"
      >
        <For each={rows()}>
          {(child) => (
            <div class="panel">
              <div class="panelItem flex-1">{child}</div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
