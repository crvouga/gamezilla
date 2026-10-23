import type { SpacePresenceRole } from './permission-catalog';

/** Resource facts read from the target before asking the policy for a decision. */
export type AccessScope = {
  readonly spacePresence?: SpacePresenceRole | null;
  readonly puzzleOwnerId?: string;
  readonly puzzlePlayerId?: string;
};
