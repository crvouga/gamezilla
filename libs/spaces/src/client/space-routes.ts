import type { Href, Router } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Expo Router href for `/space/:id` — use instead of `{ pathname, params }`. */
export function spaceDetailHref(spaceId: string): Href {
  return `/space/${spaceId}` as Href;
}

/** Expo Router href for `/space/:id/settings`. */
export function spaceSettingsHref(spaceId: string): Href {
  return `/space/${spaceId}/settings` as Href;
}

/** Drop focus on web so the previous screen can be aria-hidden without a11y warnings. */
function releaseWebFocusBeforeNavigation(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function openSpaceDetail(router: Router, spaceId: string): void {
  releaseWebFocusBeforeNavigation();
  router.push(spaceDetailHref(spaceId));
}

export function openSpaceSettings(router: Router, spaceId: string): void {
  releaseWebFocusBeforeNavigation();
  router.push(spaceSettingsHref(spaceId));
}

/**
 * Expo Router web sometimes mirrors the dynamic `[id]` segment into
 * `?id=…` even when the id is already in the path. Replace with the
 * path-only href so bookmarks and the address bar stay clean.
 */
export function useStripRedundantSpaceRouteSearchParams(spaceId: string): void {
  const router = useRouter();
  useEffect(() => {
    if (spaceId.length === 0 || typeof window === 'undefined') return;
    const search = window.location.search;
    if (search.length === 0) return;
    const params = new URLSearchParams(search);
    if (params.get('id') !== spaceId) return;
    router.replace(window.location.pathname as Href);
  }, [router, spaceId]);
}
