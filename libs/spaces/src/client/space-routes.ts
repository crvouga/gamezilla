import type { Href, Router } from 'expo-router';
import { useEffect } from 'react';
import { useLocalSearchParams, usePathname } from 'expo-router';

/** Expo Router href for `/space/:id` — use instead of `{ pathname, params }`. */
export function spaceDetailHref(
  spaceId: string,
  options?: { readonly invite?: string | null }
): Href {
  const invite = options?.invite;
  if (invite !== null && invite !== undefined && invite.length > 0) {
    return `/space/${spaceId}?invite=${encodeURIComponent(invite)}` as Href;
  }
  return `/space/${spaceId}` as Href;
}

/** Normalize a dynamic `[id]` route param (Expo may yield `string[]` when path + `?id=` duplicate). */
export function normalizeSpaceRouteParam(
  id: string | string[] | undefined
): string {
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) {
    for (const entry of id) {
      if (typeof entry === 'string' && entry.length > 0) return entry;
    }
  }
  return '';
}

/** Read the space id segment from `/space/:id` when search params are ambiguous. */
export function spaceIdFromPathname(pathname: string): string {
  const match = /^\/space\/([^/?#]+)/.exec(pathname);
  return match?.[1] ?? '';
}

/**
 * Stable space id for `/space/[id]` screens. Prefer the normalized route param;
 * fall back to the path segment so redundant `?id=` mirrors cannot blank the id.
 */
export function useSpaceRouteId(): string {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const pathname = usePathname();
  const fromParams = normalizeSpaceRouteParam(id);
  if (fromParams.length > 0) return fromParams;
  return spaceIdFromPathname(pathname);
}

/** Drop focus on web so the previous screen can be aria-hidden without a11y warnings. */
function releaseWebFocusBeforeNavigation(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function openSpaceDetail(
  router: Router,
  spaceId: string,
  options?: { readonly invite?: string | null }
): void {
  releaseWebFocusBeforeNavigation();
  router.push(spaceDetailHref(spaceId, options));
}

/** Leave `/space/:id` — pop the modal stack on iOS, fall back to lobby on deep links. */
export function closeSpaceDetail(router: Router): void {
  releaseWebFocusBeforeNavigation();
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}

/** Paths already cleaned this session (Strict Mode may invoke the stripper twice). */
const strippedSearchPaths = new Set<string>();

/**
 * Strip redundant `?id=` from `/space/:id` URLs on web without routing through
 * Expo Router — `router.replace` remounts the screen and can loop when the
 * query param is re-applied during navigation.
 */
export function stripRedundantSpaceRouteSearchParams(spaceId: string): void {
  if (spaceId.length === 0 || typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (search.length === 0) return;
  const pathKey = `${pathname}${search}`;
  if (strippedSearchPaths.has(pathKey)) return;
  const params = new URLSearchParams(search);
  if (params.get('id') !== spaceId) return;
  strippedSearchPaths.add(pathKey);
  params.delete('id');
  const next = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    next.length > 0 ? `${pathname}?${next}` : pathname
  );
}

/**
 * Expo Router web sometimes mirrors the dynamic `[id]` segment into
 * `?id=…` even when the id is already in the path. Replace with the
 * path-only href so bookmarks and the address bar stay clean.
 */
export function useStripRedundantSpaceRouteSearchParams(spaceId: string): void {
  useEffect(() => {
    stripRedundantSpaceRouteSearchParams(spaceId);
  }, [spaceId]);
}
