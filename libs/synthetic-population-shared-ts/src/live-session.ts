import { z } from 'zod';

/**
 * Who is online now, and what each one sees: the contract between the app's
 * live-session reporter (every app, a person's or a Synthetic User's), the
 * server that keeps it, and the Bot Observatory that shows it.
 */

/** How often an open app tells the server it is still online now. */
export const LIVE_HEARTBEAT_MS = 15_000;
/** An app is online now while its last heartbeat is this recent. */
export const LIVE_ONLINE_WINDOW_MS = 40_000;
/** While watched live, how often the app sends what its screen shows. */
export const LIVE_FRAME_INTERVAL_MS = 1_000;
/** A watch lasts this long past the watcher's last look at the screen. */
export const LIVE_WATCH_LEASE_MS = 15_000;
/** A screen frame larger than this is not kept. */
export const LIVE_FRAME_MAX_CHARS = 400_000;

/** Where in the app someone is, independent of the language they read it in. */
export const LIVE_PLACES = [
  'spaces',
  'space',
  'people-search',
  'settings',
  'profile',
  'notifications',
  'observatory',
  'other',
] as const;
export const livePlaceSchema = z.enum(LIVE_PLACES);
export type LivePlace = z.infer<typeof livePlaceSchema>;

/** What someone online now is doing. */
export const LIVE_ACTIVITIES = ['browsing', 'looking', 'playing'] as const;
export const liveActivitySchema = z.enum(LIVE_ACTIVITIES);
export type LiveActivity = z.infer<typeof liveActivitySchema>;

/** A person, or a Synthetic User; only the server decides which. */
export const LIVE_KINDS = ['person', 'synthetic'] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];

/** Which of those online now the Bot Observatory shows. */
export const ONLINE_NOW_FILTERS = ['everyone', 'people', 'synthetic'] as const;
export const onlineNowFilterSchema = z.enum(ONLINE_NOW_FILTERS);
export type OnlineNowFilter = z.infer<typeof onlineNowFilterSchema>;

/** What an open app reports about itself on each heartbeat. */
export const liveHeartbeatSchema = z.object({
  place: livePlaceSchema,
  activity: liveActivitySchema,
  /** The game's display name while looking for an opponent or playing. */
  game: z.string().min(1).max(64).nullable(),
});
export type LiveHeartbeat = z.infer<typeof liveHeartbeatSchema>;

/** One sanitized picture of what the watched app's screen shows. */
export const liveFrameSchema = z.object({
  html: z.string().max(LIVE_FRAME_MAX_CHARS),
  capturedAtMs: z.number().nonnegative(),
});
export type LiveFrame = z.infer<typeof liveFrameSchema>;

/** What the server answers a heartbeat: whether someone is watching live. */
export type LiveHeartbeatAnswer = { readonly watched: boolean };

/** Pub/sub notices on the Bot Observatory topic. */
export const LIVE_PRESENCE_CHANGED = 'live-presence-changed';
export const LIVE_FRAME_CHANGED = 'live-frame';

/** The place a route belongs to; the route itself is never stored. */
export function placeOfRoute(path: string): LivePlace {
  const route = path.split(/[?#]/)[0] ?? '';
  if (route === '/' || route === '') return 'spaces';
  if (route.startsWith('/space/')) return 'space';
  if (route === '/search' || route.startsWith('/search/'))
    return 'people-search';
  if (route === '/more' || route.startsWith('/more/')) return 'settings';
  if (route === '/profile' || route.startsWith('/profile/')) return 'profile';
  if (route.startsWith('/notifications')) return 'notifications';
  if (route.startsWith('/admin/')) return 'observatory';
  return 'other';
}

/** A notice on the Bot Observatory topic, as a subscriber reads it. */
export function liveNotice(
  data: unknown
): { type: string; sessionId: string | null } | null {
  if (typeof data !== 'object' || data === null) return null;
  const type = (data as { type?: unknown }).type;
  const sessionId = (data as { sessionId?: unknown }).sessionId;
  return typeof type === 'string'
    ? { type, sessionId: typeof sessionId === 'string' ? sessionId : null }
    : null;
}
