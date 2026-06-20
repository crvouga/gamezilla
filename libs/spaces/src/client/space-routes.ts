import type { Href } from 'expo-router';

/** Expo Router href for `/space/:id` — use instead of `{ pathname, params }`. */
export function spaceDetailHref(spaceId: string): Href {
  return `/space/${spaceId}` as Href;
}

/** Expo Router href for `/space/:id/settings`. */
export function spaceSettingsHref(spaceId: string): Href {
  return `/space/${spaceId}/settings` as Href;
}
