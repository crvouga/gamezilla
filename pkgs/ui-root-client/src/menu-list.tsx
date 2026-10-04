/** @jsxImportSource solid-js */
/**
 * `MenuList` -- full-bleed stack of {@link MenuRow}s (`role="menu"`).
 *
 * Cancels the nearest shell's horizontal edge padding via
 * `useContentEdgePaddingStep` so rows span the full content width. Pass
 * `class` / `style` to forward screen-body layout (e.g. `flex-1`).
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
import { spacingScale } from '@pkgs/ui-root-shared/scale';
import {
  createMemo,
  For,
  type JSX,
  children as resolveChildren,
  Show,
} from 'solid-js';
import {
  CONTENT_EDGE_PADDING_STEP,
  useContentEdgePaddingStep,
} from './content-edge-padding';
import { MENU_ROW_PX_STEP } from './menu-row';

export type MenuListProps = {
  children: JSX.Element;
  /** Extra classes on the menu host (e.g. `flex-1`). */
  class?: string | undefined;
  /** Inline styles on the menu host. */
  style?: JSX.CSSProperties | undefined;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Separator inset matches `MenuRow`'s horizontal padding. */
const SEPARATOR_INSET_STEP = MENU_ROW_PX_STEP;

export function MenuList(props: MenuListProps): JSX.Element {
  const edgeStep = useContentEdgePaddingStep() ?? CONTENT_EDGE_PADDING_STEP;
  const resolved = resolveChildren(() => props.children);
  const rows = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  const separator = () => props.separator ?? true;
  const edgeBleed = (): JSX.CSSProperties | undefined => {
    if (edgeStep === 0) return undefined;
    const mx = `-${spacingScale(edgeStep)}px`;
    return { 'margin-left': mx, 'margin-right': mx };
  };
  return (
    <div
      class="box"
      classList={{ [String(props.class)]: true }}
      {...dataAttrs({ component: 'MenuList', ...props.dataSet })}
      role="menu"
      style={{ ...edgeBleed(), ...props.style }}
    >
      <For each={rows()}>
        {(child, index) => (
          <div class="box">
            {child}
            <Show when={separator() && index() < rows().length - 1}>
              <div
                class="box border-b border-border"
                aria-hidden="true"
                style={{
                  'margin-left': `${spacingScale(SEPARATOR_INSET_STEP)}px`,
                  'margin-right': `${spacingScale(SEPARATOR_INSET_STEP)}px`,
                }}
              />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
