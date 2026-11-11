/**
 * Where the User Observatory lives in the app. The Synthetic Population
 * panel is nested inside it, so both read their addresses from here.
 *
 * Hubs only link onward; each list of people, Synthetic Users, workers or
 * events is a table screen of its own, and each form a screen of its own.
 */

/** The User Observatory: links to Online now and the Synthetic Population panel. */
export const OBSERVATORY_PATH = '/admin/observatory';

/** Online now: whoever is using the app, people and Synthetic Users, as a table. */
export const ONLINE_NOW_PATH = `${OBSERVATORY_PATH}/online`;

/** Watching one app live, by its live session. */
export function liveWatchPath(sessionId: string): string {
  return `${OBSERVATORY_PATH}/live/${sessionId}`;
}

/** The Synthetic Population panel: links to its tables and settings. */
export const SYNTHETIC_USERS_PATH = `${OBSERVATORY_PATH}/synthetic-users`;

/** The Synthetic Users, as a table. */
export const SYNTHETIC_USER_DIRECTORY_PATH = `${SYNTHETIC_USERS_PATH}/directory`;

/** The Synthetic Population Workers, as a table. */
export const SYNTHETIC_POPULATION_WORKERS_PATH = `${SYNTHETIC_USERS_PATH}/workers`;

/** The Synthetic Population's recorded events, as a table. */
export const SYNTHETIC_POPULATION_EVENTS_PATH = `${SYNTHETIC_USERS_PATH}/events`;

/** The desired synthetic population form. */
export const SYNTHETIC_POPULATION_SETTINGS_PATH = `${SYNTHETIC_USERS_PATH}/settings`;

/** One Synthetic User's control panel. */
export function syntheticUserPath(id: string): string {
  return `${SYNTHETIC_USERS_PATH}/${id}`;
}

/** One Synthetic User's recorded events, as a table. */
export function syntheticUserEventsPath(id: string): string {
  return `${syntheticUserPath(id)}/events`;
}

/** Replaying one Synthetic User's recorded decisions. */
export function syntheticUserReplayPath(id: string): string {
  return `${syntheticUserPath(id)}/replay`;
}

/** One Synthetic User's in-process UI inspector (its live DOM capture). */
export function syntheticUserInspectorPath(id: string): string {
  return `${syntheticUserPath(id)}/inspector`;
}
