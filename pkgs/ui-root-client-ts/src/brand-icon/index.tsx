/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { BrandIconName } from '../brand-icon-registry';
import { BRAND_ICON_REGISTRY } from '../brand-icon-registry';

export type BrandIconProps = {
  name: BrandIconName;
  /** Square size in pixels. Defaults to 20. */
  size?: number | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `BrandIcon` -- third-party brand logo primitive (Google, etc.). Uses the
 * vendor's published colors and cannot be retinted by the theme.
 *
 * @example
 * ```tsx
 * <BrandIcon name="google" size={20} />
 * ```
 */
export function BrandIcon(props: BrandIconProps): JSX.Element {
  return (
    <span
      class="box inline-flex items-center justify-center"
      {...dataAttrs({
        component: 'BrandIcon',
        brand: props.name,
        ...props.dataSet,
      })}
    >
      <Dynamic
        component={BRAND_ICON_REGISTRY[props.name]}
        size={props.size ?? 20}
      />
    </span>
  );
}
