/**
 * Single registry: public `BrandIcon` names → fixed-color brand logo SVG components.
 *
 * Unlike {@link import('../symbol-icon').IconSymbol IconSymbol}, brand logos
 * never accept a `color` prop because their colors are dictated by each
 * vendor's branding guidelines.
 */

import type { ComponentType } from 'react';

import { GoogleBrandLogo, type BrandIconSvgProps } from './svg/brand-logos';

export type BrandIconComponent = ComponentType<BrandIconSvgProps>;

export const BRAND_ICON_REGISTRY = {
  google: GoogleBrandLogo,
} as const satisfies Record<string, BrandIconComponent>;

export type BrandIconName = keyof typeof BRAND_ICON_REGISTRY;
