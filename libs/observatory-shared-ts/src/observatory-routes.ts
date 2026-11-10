/**
 * Where the User Observatory lives in the app. The Synthetic Population
 * panel is nested inside it, so both read their addresses from here.
 */

/** The User Observatory: whoever is online now. */
export const OBSERVATORY_PATH = '/admin/observatory';

/** Watching one app live, by its live session. */
export function liveWatchPath(sessionId: string): string {
  return `${OBSERVATORY_PATH}/live/${sessionId}`;
}

/** The Synthetic Population panel: the Synthetic Users' own part of it. */
export const SYNTHETIC_USERS_PATH = `${OBSERVATORY_PATH}/synthetic-users`;

/** The desired synthetic population, inside the Synthetic Population panel. */
export const SYNTHETIC_USERS_CONFIG_PATH = `${SYNTHETIC_USERS_PATH}/config`;

/** Controls for every Synthetic User at once. */
export const SYNTHETIC_USERS_CONTROL_PATH = `${SYNTHETIC_USERS_PATH}/control`;

/** One Synthetic User's control panel. */
export function syntheticUserPath(id: string): string {
  return `${SYNTHETIC_USERS_PATH}/${id}`;
}
