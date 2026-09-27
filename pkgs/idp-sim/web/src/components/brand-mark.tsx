/**
 * The simulator's mark: a keyhole on a rounded tile.
 *
 * Deliberately geometric and one-colour — it has to read as *a* provider at
 * 28px without borrowing any real one's identity. It paints with the design
 * system's tint, so it follows the light / dark scheme with everything else.
 */

import { colorVar } from '@pkgs/ui/theme/css-vars';

import { IDP_BRAND } from '../../../src/shared/brand';

/** In the card; the refusal screen gets the larger standalone mark. */
export const IDP_MARK_SIZE = 28;
export const IDP_MARK_ERROR_SIZE = 36;

export function BrandMark(props: { readonly size?: number | undefined }) {
  const size = (): number => props.size ?? IDP_MARK_SIZE;
  return (
    <svg
      class="shrink-0"
      width={size()}
      height={size()}
      viewBox="0 0 48 48"
      role="img"
      aria-label={IDP_BRAND.name}
    >
      <rect width="48" height="48" rx="12" fill={colorVar('tint')} />
      <circle cx="24" cy="20" r="6.5" fill={colorVar('onPrimary')} />
      <path
        d="M21.4 25.5h5.2l1.9 9.8a1 1 0 0 1-1 1.2h-7a1 1 0 0 1-1-1.2z"
        fill={colorVar('onPrimary')}
      />
    </svg>
  );
}

/** Mark plus wordmark — the page's only statement of whose screen this is. */
export function BrandLockup(props: { readonly size?: number | undefined }) {
  return (
    <div class="box flex-row items-center gap-2.5">
      <BrandMark size={props.size} />
      <span class="text textBodyBold tracking-tight">{IDP_BRAND.name}</span>
    </div>
  );
}
