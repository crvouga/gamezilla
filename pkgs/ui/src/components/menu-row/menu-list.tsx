/** @jsxImportSource solid-js */
/**
 * `MenuList` -- full-bleed stack of {@link MenuRow}s (`role="menu"`).
 *
 * Cancels the nearest shell's horizontal edge padding via
 * `useContentEdgePaddingStep` so rows span the full content width. Pass
 * `sx` to forward a screen body `sx` (e.g. `{ flex: 1 }` on non-scroll
 * bodies).
 *
 * @example
 * ```tsx
 * <MenuList>
 *   <MenuRow title="Account" onClick={goAccount} />
 *   <MenuRow title="Appearance" onClick={goTheme} />
 * </MenuList>
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
import type { SxInput } from '../../theme';
import { Box } from '../box';
import {
  CONTENT_EDGE_PADDING_STEP,
  useContentEdgePaddingStep,
} from '../content-edge-padding';
import { MENU_ROW_PX_STEP } from './menu-row';

export type MenuListProps = {
  children: JSX.Element;
  /** Forward a screen body `sx` (e.g. `{ flex: 1 }`). */
  sx?: SxInput | undefined;
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
  return (
    <Box
      role="menu"
      sx={[props.sx, edgeStep !== 0 ? { mx: -edgeStep } : false]}
      dataSet={{ component: 'MenuList', ...props.dataSet }}
    >
      <For each={rows()}>
        {(child, index) => (
          <Box>
            {child}
            <Show when={separator() && index() < rows().length - 1}>
              <Box
                aria-hidden="true"
                sx={{
                  borderBottomWidth: 'hairline',
                  borderColor: 'border',
                  mx: SEPARATOR_INSET_STEP,
                }}
              />
            </Show>
          </Box>
        )}
      </For>
    </Box>
  );
}
