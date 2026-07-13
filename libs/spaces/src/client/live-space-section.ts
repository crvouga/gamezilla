export type LiveSpaceSection = 'friends' | 'public';

/** Non-UI section ids for lobby queries. */
export const LIVE_SPACE_SECTION = {
  friends: 'friends',
  public: 'public',
} as const satisfies Record<LiveSpaceSection, LiveSpaceSection>;
