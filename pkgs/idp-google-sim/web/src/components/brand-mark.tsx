/**
 * The simulator's mark: a keyhole on a rounded tile.
 *
 * Deliberately geometric and one-colour — it has to read as *a* provider at
 * 28px without borrowing any real one's identity.
 */

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
      <rect width="48" height="48" rx="12" class="fill-idp-primary" />
      <circle cx="24" cy="20" r="6.5" class="fill-white" />
      <path
        d="M21.4 25.5h5.2l1.9 9.8a1 1 0 0 1-1 1.2h-7a1 1 0 0 1-1-1.2z"
        class="fill-white"
      />
    </svg>
  );
}

/** Mark plus wordmark — the page's only statement of whose screen this is. */
export function BrandLockup(props: { readonly size?: number | undefined }) {
  return (
    <div class="flex items-center gap-2.5">
      <BrandMark size={props.size} />
      <span class="text-[15px] font-semibold tracking-tight text-idp-on-surface">
        {IDP_BRAND.name}
      </span>
    </div>
  );
}
