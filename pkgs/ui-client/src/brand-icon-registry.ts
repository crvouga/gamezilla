/**
 * Single registry: public `BrandIcon` names → fixed-color brand logo SVG
 * components. Brand logos never accept a `color` prop because their colors
 * are dictated by each vendor's branding guidelines.
 */

import type { Component } from 'solid-js';
import { AppleBrandLogo, DevIdpBrandLogo, GoogleBrandLogo } from './brand-logos';
import type { BrandIconSvgProps } from './brand-logos';

export type BrandIconComponent = Component<BrandIconSvgProps>;

export const BRAND_ICON_REGISTRY = {
  google: GoogleBrandLogo,
  apple: AppleBrandLogo,
  dev: DevIdpBrandLogo,
} as const satisfies Record<string, BrandIconComponent>;

export type BrandIconName = keyof typeof BRAND_ICON_REGISTRY;
