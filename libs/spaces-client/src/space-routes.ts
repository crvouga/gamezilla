import type { AppRouter } from '@pkgs/ui-root-client/app-router';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { releaseWebFocus } from '@pkgs/ui-root-shared/release-web-focus';
import { type Accessor, createMemo } from 'solid-js';

/** Path href for `/space/:id`. */
export function spaceDetailHref(spaceId: string): string {
  return `/space/${spaceId}`;
}

/** Query parameter a space opens with to start playing a game at once. */
export const SPACE_GAME_PARAM = 'game';

/**
 * `/space/:id` opening straight into `game` for its host; `extra` carries
 * what the game itself is asked to open (a puzzle, …).
 */
export function spaceGameHref(
  spaceId: string,
  game: string,
  extra: Readonly<Record<string, string>> = {}
): string {
  const query = new URLSearchParams({ [SPACE_GAME_PARAM]: game, ...extra });
  return `${spaceDetailHref(spaceId)}?${query.toString()}`;
}

/** Normalize a dynamic `id` route param. */
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

/**
 * Stable space id for Space screens. Prefer the route param; hold the last
 * non-empty id so brief param gaps do not unmount the space session.
 */
export function useSpaceRouteId(): Accessor<string> {
  const params = useLocalSearchParams<{ id?: string | undefined }>();
  const lastRef = { current: normalizeSpaceRouteParam(params().id) };
  return createMemo(() => {
    const fromParams = normalizeSpaceRouteParam(params().id);
    if (fromParams.length > 0) {
      lastRef.current = fromParams;
      return fromParams;
    }
    return lastRef.current;
  });
}

export function openSpaceDetail(router: AppRouter, spaceId: string): void {
  releaseWebFocus();
  router.push(spaceDetailHref(spaceId));
}

/** Leave space detail — pop the modal stack, fall back to lobby. */
export function closeSpaceDetail(router: AppRouter): void {
  releaseWebFocus();
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}
