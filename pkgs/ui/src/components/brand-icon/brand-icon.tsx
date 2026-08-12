/**
 * `BrandIcon` -- third-party brand logo primitive (Google, etc.).
 *
 * Companion to the design-system icon set. The
 * key difference: brand icons use the vendor's published colors and do not
 * accept a `color` prop, so they cannot be retinted by the theme.
 *
 * @example
 * ```tsx
 * <BrandIcon name="google" size={20} />
 * ```
 */

import { assert } from '@pkgs/assert';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { BRAND_ICON_REGISTRY, type BrandIconName } from './brand-icon-registry';

export type { BrandIconName };

export type BrandIconProps = {
  name: BrandIconName;
  /** Square size in pixels. Defaults to 20. */
  size?: number;
  sx?: SxInput;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function BrandIcon({ name, size = 20, sx, dataSet }: BrandIconProps) {
  const Logo = BRAND_ICON_REGISTRY[name];
  assert.defined(Logo, `BrandIcon: unknown name "${String(name)}"`);
  return (
    <Box
      dataSet={{ component: 'BrandIcon', ...dataSet }}
      sx={[{ alignItems: 'center', justifyContent: 'center' }, sx]}
    >
      <Logo size={size} />
    </Box>
  );
}
