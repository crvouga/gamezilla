/**
 * Class tables for the `SpaceToken` props (`gap`, `padding*`). Every utility
 * is `<property>-ui-<token>`, bound to `--ui-space-<token>` by the theme
 * (`theme.css`), so a spacing prop renders the token and nothing
 * else. Rows are written out in full for the stylesheet scanner.
 */

import type { SpaceToken } from '@pkgs/ui-root-shared/token-names';
import type { Responsive } from './responsive';
import { responsiveClass, responsiveTable } from './responsive';

/** Space between children, and padding inside the box. */
export type SpacingProps = {
  /** Space between children. The only spacing between siblings. */
  gap?: Responsive<SpaceToken> | undefined;
  /** Padding on all four sides. */
  padding?: Responsive<SpaceToken> | undefined;
  /** Inline (start and end) padding. */
  paddingX?: Responsive<SpaceToken> | undefined;
  /** Block (top and bottom) padding. */
  paddingY?: Responsive<SpaceToken> | undefined;
  paddingTop?: Responsive<SpaceToken> | undefined;
  paddingBottom?: Responsive<SpaceToken> | undefined;
  /** Inline-start padding (left in a left-to-right script). */
  paddingStart?: Responsive<SpaceToken> | undefined;
  /** Inline-end padding (right in a left-to-right script). */
  paddingEnd?: Responsive<SpaceToken> | undefined;
};

const GAP = responsiveTable<SpaceToken>({
  none: 'gap-ui-none sm:gap-ui-none md:gap-ui-none lg:gap-ui-none xl:gap-ui-none',
  xs: 'gap-ui-xs sm:gap-ui-xs md:gap-ui-xs lg:gap-ui-xs xl:gap-ui-xs',
  sm: 'gap-ui-sm sm:gap-ui-sm md:gap-ui-sm lg:gap-ui-sm xl:gap-ui-sm',
  md: 'gap-ui-md sm:gap-ui-md md:gap-ui-md lg:gap-ui-md xl:gap-ui-md',
  lg: 'gap-ui-lg sm:gap-ui-lg md:gap-ui-lg lg:gap-ui-lg xl:gap-ui-lg',
  xl: 'gap-ui-xl sm:gap-ui-xl md:gap-ui-xl lg:gap-ui-xl xl:gap-ui-xl',
  '2xl': 'gap-ui-2xl sm:gap-ui-2xl md:gap-ui-2xl lg:gap-ui-2xl xl:gap-ui-2xl',
  '3xl': 'gap-ui-3xl sm:gap-ui-3xl md:gap-ui-3xl lg:gap-ui-3xl xl:gap-ui-3xl',
});

const PADDING = responsiveTable<SpaceToken>({
  none: 'p-ui-none sm:p-ui-none md:p-ui-none lg:p-ui-none xl:p-ui-none',
  xs: 'p-ui-xs sm:p-ui-xs md:p-ui-xs lg:p-ui-xs xl:p-ui-xs',
  sm: 'p-ui-sm sm:p-ui-sm md:p-ui-sm lg:p-ui-sm xl:p-ui-sm',
  md: 'p-ui-md sm:p-ui-md md:p-ui-md lg:p-ui-md xl:p-ui-md',
  lg: 'p-ui-lg sm:p-ui-lg md:p-ui-lg lg:p-ui-lg xl:p-ui-lg',
  xl: 'p-ui-xl sm:p-ui-xl md:p-ui-xl lg:p-ui-xl xl:p-ui-xl',
  '2xl': 'p-ui-2xl sm:p-ui-2xl md:p-ui-2xl lg:p-ui-2xl xl:p-ui-2xl',
  '3xl': 'p-ui-3xl sm:p-ui-3xl md:p-ui-3xl lg:p-ui-3xl xl:p-ui-3xl',
});

const PADDING_X = responsiveTable<SpaceToken>({
  none: 'px-ui-none sm:px-ui-none md:px-ui-none lg:px-ui-none xl:px-ui-none',
  xs: 'px-ui-xs sm:px-ui-xs md:px-ui-xs lg:px-ui-xs xl:px-ui-xs',
  sm: 'px-ui-sm sm:px-ui-sm md:px-ui-sm lg:px-ui-sm xl:px-ui-sm',
  md: 'px-ui-md sm:px-ui-md md:px-ui-md lg:px-ui-md xl:px-ui-md',
  lg: 'px-ui-lg sm:px-ui-lg md:px-ui-lg lg:px-ui-lg xl:px-ui-lg',
  xl: 'px-ui-xl sm:px-ui-xl md:px-ui-xl lg:px-ui-xl xl:px-ui-xl',
  '2xl': 'px-ui-2xl sm:px-ui-2xl md:px-ui-2xl lg:px-ui-2xl xl:px-ui-2xl',
  '3xl': 'px-ui-3xl sm:px-ui-3xl md:px-ui-3xl lg:px-ui-3xl xl:px-ui-3xl',
});

const PADDING_Y = responsiveTable<SpaceToken>({
  none: 'py-ui-none sm:py-ui-none md:py-ui-none lg:py-ui-none xl:py-ui-none',
  xs: 'py-ui-xs sm:py-ui-xs md:py-ui-xs lg:py-ui-xs xl:py-ui-xs',
  sm: 'py-ui-sm sm:py-ui-sm md:py-ui-sm lg:py-ui-sm xl:py-ui-sm',
  md: 'py-ui-md sm:py-ui-md md:py-ui-md lg:py-ui-md xl:py-ui-md',
  lg: 'py-ui-lg sm:py-ui-lg md:py-ui-lg lg:py-ui-lg xl:py-ui-lg',
  xl: 'py-ui-xl sm:py-ui-xl md:py-ui-xl lg:py-ui-xl xl:py-ui-xl',
  '2xl': 'py-ui-2xl sm:py-ui-2xl md:py-ui-2xl lg:py-ui-2xl xl:py-ui-2xl',
  '3xl': 'py-ui-3xl sm:py-ui-3xl md:py-ui-3xl lg:py-ui-3xl xl:py-ui-3xl',
});

const PADDING_TOP = responsiveTable<SpaceToken>({
  none: 'pt-ui-none sm:pt-ui-none md:pt-ui-none lg:pt-ui-none xl:pt-ui-none',
  xs: 'pt-ui-xs sm:pt-ui-xs md:pt-ui-xs lg:pt-ui-xs xl:pt-ui-xs',
  sm: 'pt-ui-sm sm:pt-ui-sm md:pt-ui-sm lg:pt-ui-sm xl:pt-ui-sm',
  md: 'pt-ui-md sm:pt-ui-md md:pt-ui-md lg:pt-ui-md xl:pt-ui-md',
  lg: 'pt-ui-lg sm:pt-ui-lg md:pt-ui-lg lg:pt-ui-lg xl:pt-ui-lg',
  xl: 'pt-ui-xl sm:pt-ui-xl md:pt-ui-xl lg:pt-ui-xl xl:pt-ui-xl',
  '2xl': 'pt-ui-2xl sm:pt-ui-2xl md:pt-ui-2xl lg:pt-ui-2xl xl:pt-ui-2xl',
  '3xl': 'pt-ui-3xl sm:pt-ui-3xl md:pt-ui-3xl lg:pt-ui-3xl xl:pt-ui-3xl',
});

const PADDING_BOTTOM = responsiveTable<SpaceToken>({
  none: 'pb-ui-none sm:pb-ui-none md:pb-ui-none lg:pb-ui-none xl:pb-ui-none',
  xs: 'pb-ui-xs sm:pb-ui-xs md:pb-ui-xs lg:pb-ui-xs xl:pb-ui-xs',
  sm: 'pb-ui-sm sm:pb-ui-sm md:pb-ui-sm lg:pb-ui-sm xl:pb-ui-sm',
  md: 'pb-ui-md sm:pb-ui-md md:pb-ui-md lg:pb-ui-md xl:pb-ui-md',
  lg: 'pb-ui-lg sm:pb-ui-lg md:pb-ui-lg lg:pb-ui-lg xl:pb-ui-lg',
  xl: 'pb-ui-xl sm:pb-ui-xl md:pb-ui-xl lg:pb-ui-xl xl:pb-ui-xl',
  '2xl': 'pb-ui-2xl sm:pb-ui-2xl md:pb-ui-2xl lg:pb-ui-2xl xl:pb-ui-2xl',
  '3xl': 'pb-ui-3xl sm:pb-ui-3xl md:pb-ui-3xl lg:pb-ui-3xl xl:pb-ui-3xl',
});

const PADDING_START = responsiveTable<SpaceToken>({
  none: 'ps-ui-none sm:ps-ui-none md:ps-ui-none lg:ps-ui-none xl:ps-ui-none',
  xs: 'ps-ui-xs sm:ps-ui-xs md:ps-ui-xs lg:ps-ui-xs xl:ps-ui-xs',
  sm: 'ps-ui-sm sm:ps-ui-sm md:ps-ui-sm lg:ps-ui-sm xl:ps-ui-sm',
  md: 'ps-ui-md sm:ps-ui-md md:ps-ui-md lg:ps-ui-md xl:ps-ui-md',
  lg: 'ps-ui-lg sm:ps-ui-lg md:ps-ui-lg lg:ps-ui-lg xl:ps-ui-lg',
  xl: 'ps-ui-xl sm:ps-ui-xl md:ps-ui-xl lg:ps-ui-xl xl:ps-ui-xl',
  '2xl': 'ps-ui-2xl sm:ps-ui-2xl md:ps-ui-2xl lg:ps-ui-2xl xl:ps-ui-2xl',
  '3xl': 'ps-ui-3xl sm:ps-ui-3xl md:ps-ui-3xl lg:ps-ui-3xl xl:ps-ui-3xl',
});

const PADDING_END = responsiveTable<SpaceToken>({
  none: 'pe-ui-none sm:pe-ui-none md:pe-ui-none lg:pe-ui-none xl:pe-ui-none',
  xs: 'pe-ui-xs sm:pe-ui-xs md:pe-ui-xs lg:pe-ui-xs xl:pe-ui-xs',
  sm: 'pe-ui-sm sm:pe-ui-sm md:pe-ui-sm lg:pe-ui-sm xl:pe-ui-sm',
  md: 'pe-ui-md sm:pe-ui-md md:pe-ui-md lg:pe-ui-md xl:pe-ui-md',
  lg: 'pe-ui-lg sm:pe-ui-lg md:pe-ui-lg lg:pe-ui-lg xl:pe-ui-lg',
  xl: 'pe-ui-xl sm:pe-ui-xl md:pe-ui-xl lg:pe-ui-xl xl:pe-ui-xl',
  '2xl': 'pe-ui-2xl sm:pe-ui-2xl md:pe-ui-2xl lg:pe-ui-2xl xl:pe-ui-2xl',
  '3xl': 'pe-ui-3xl sm:pe-ui-3xl md:pe-ui-3xl lg:pe-ui-3xl xl:pe-ui-3xl',
});

/** Classes for every spacing prop that is set. */
export function spacingClass(spacing: SpacingProps): string {
  return [
    responsiveClass(GAP, spacing.gap),
    responsiveClass(PADDING, spacing.padding),
    responsiveClass(PADDING_X, spacing.paddingX),
    responsiveClass(PADDING_Y, spacing.paddingY),
    responsiveClass(PADDING_TOP, spacing.paddingTop),
    responsiveClass(PADDING_BOTTOM, spacing.paddingBottom),
    responsiveClass(PADDING_START, spacing.paddingStart),
    responsiveClass(PADDING_END, spacing.paddingEnd),
  ]
    .filter((part) => part !== '')
    .join(' ');
}
