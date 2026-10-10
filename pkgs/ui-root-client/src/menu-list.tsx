/** @jsxImportSource solid-js */
/**
 * `MenuList` -- a panel of {@link MenuRow}s (`role="menu"`).
 *
 * One surface with the panel radius, hairlines between rows inset to the
 * text column (`.panel` / `.panelItem` in `hosts.css`). It sits inside the
 * screen's edge padding like every other block, so a list lines up with the
 * copy around it. Pass `class` / `style` to forward screen-body layout (e.g.
 * `flex-1`).
 *
 * @example
 * ```tsx
 * <MenuList>
 *   <MenuRow title="Account" onClick={goAccount} />
 *   <MenuRow title="Appearance" onClick={goTheme} />
 * </MenuList>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
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
  /** Extra classes on the menu host (e.g. `flex-1`). */
  class?: string | undefined;
  /** Inline styles on the menu host. */
  style?: JSX.CSSProperties | undefined;
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
        [String(props.class)]: props.class !== undefined,
      }}
      {...dataAttrs({ component: 'MenuList', ...props.dataSet })}
      role={props.role ?? 'menu'}
      style={props.style}
    >
      <For each={rows()}>{(child) => <div class="panelItem">{child}</div>}</For>
    </div>
  );
}
