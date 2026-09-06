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
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { BRAND_ICON_REGISTRY, type BrandIconName } from './brand-icon-registry';

export type { BrandIconName };

export type BrandIconProps = {
  name: BrandIconName;
  /** Square size in pixels. Defaults to 20. */
  size?: number | undefined;
  sx?: SxInput | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export function BrandIcon(props: BrandIconProps): JSX.Element {
  return (
    <Box
      as="span"
      dataSet={{ component: 'BrandIcon', brand: props.name, ...props.dataSet }}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        props.sx,
      ]}
    >
      <Dynamic
        component={BRAND_ICON_REGISTRY[props.name]}
        size={props.size ?? 20}
      />
    </Box>
  );
}
