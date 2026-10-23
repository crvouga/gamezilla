/** @jsxImportSource solid-js */
/**
 * `MenuList` -- a panel of {@link MenuRow}s (`role="menu"`).
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

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createMemo,
  For,
  type JSX,
  children as resolveChildren,
} from 'solid-js';

export type MenuListProps = {
  children: JSX.Element;
  /** Mixed links and form controls are a group, not an ARIA command menu. */
  role?: 'menu' | 'group' | undefined;
  /** Claim the leftover height of a flex column (a screen body). */
  grow?: boolean | undefined;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function MenuList(props: MenuListProps): JSX.Element {
  const resolved = resolveChildren(() => props.children);
  const rows = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  return (
    <div
      class="panel"
      classList={{
        panelPlain: props.separator === false,
        'flex-1': props.grow === true,
      }}
      {...dataAttrs({ component: 'MenuList', ...props.dataSet })}
      role={props.role ?? 'menu'}
    >
      <For each={rows()}>{(child) => <div class="panelItem">{child}</div>}</For>
    </div>
  );
}
