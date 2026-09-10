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
import { type ComponentDataSet, dataAttrs } from '../../component-id';
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
    <span
      class="box inline-flex items-center justify-center"
      classList={{ [String(props.class)]: true }}
      {...dataAttrs({
        component: 'BrandIcon',
        brand: props.name,
        ...props.dataSet,
      })}
      style={props.style}
    >
      <Dynamic
        component={BRAND_ICON_REGISTRY[props.name]}
        size={props.size ?? 20}
      />
    </span>
  );
}
