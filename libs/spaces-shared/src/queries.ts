import { mySpaceUsers } from './my-space-users-query';
import { mySpaces } from './my-spaces-query';
import { openSpaceSessions } from './open-space-sessions-query';
import { spaceByLink } from './space-by-link-query';

export const SPACE_QUERIES = [
  mySpaces,
  mySpaceUsers,
  openSpaceSessions,
  spaceByLink,
] as const;
