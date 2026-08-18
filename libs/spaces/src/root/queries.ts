import { mySpaceUsers } from '../use-cases/list-my-space-users/shared/my-space-users-query';
import { mySpaces } from '../use-cases/list-my-spaces/shared/my-spaces-query';
import { openSpaceSessions } from '../use-cases/list-open-sessions/shared/open-space-sessions-query';

export const SPACE_QUERIES = [
  mySpaces,
  mySpaceUsers,
  openSpaceSessions,
] as const;
