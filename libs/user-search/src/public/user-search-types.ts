/** Username / people picker search result (not friendship graph state). */
export type UserSearchResult = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig: string | null;
};

export const USER_SEARCH_MAX_RESULTS = 20;

/** How long a keystroke waits before the people search runs. */
export const USER_SEARCH_DEBOUNCE_MS = 300;
export const USER_SEARCH_RATE_LIMIT = 30;
export const USER_SEARCH_RATE_WINDOW_MS = 60 * 1000;
