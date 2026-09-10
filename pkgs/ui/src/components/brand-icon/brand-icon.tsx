/** @jsxImportSource solid-js */
/**
 * `BrandIcon` -- third-party brand logo primitive (Google, etc.). Uses the
 * vendor's published colors and cannot be retinted by the theme.
 *
 * @example
 * ```tsx
 * <BrandIcon name="google" size={20} />
 * ```
 */

import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { Box, joinClass } from '../box';
import { BRAND_ICON_REGISTRY, type BrandIconName } from './brand-icon-registry';

export type { BrandIconName };

export type BrandIconProps = {
  name: BrandIconName;
  /** Square size in pixels. Defaults to 20. */
  size?: number | undefined;
  class?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export function BrandIcon(props: BrandIconProps): JSX.Element {
  return (
    <Box
      as="span"
      class={joinClass('inline-flex items-center justify-center', props.class)}
      style={props.style}
      dataSet={{ component: 'BrandIcon', brand: props.name, ...props.dataSet }}
    >
      <Dynamic
        component={BRAND_ICON_REGISTRY[props.name]}
        size={props.size ?? 20}
      />
    </Box>
  );
}
