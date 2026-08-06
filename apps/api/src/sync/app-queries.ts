import { queryRegistry } from '@pkgs/queries/core/registry';

import { AUTH_QUERIES } from './queries/auth-queries';
import { CHESS_QUERIES } from './queries/chess-queries';
import { FRIENDS_QUERIES } from './queries/friends-queries';
import { MISC_QUERIES } from './queries/misc-queries';
import { PROFILE_QUERIES } from './queries/profile-queries';
import { SPACE_QUERIES } from './queries/space-queries';

export const APP_QUERIES = queryRegistry([
  ...AUTH_QUERIES,
  ...PROFILE_QUERIES,
  ...SPACE_QUERIES,
  ...FRIENDS_QUERIES,
  ...CHESS_QUERIES,
  ...MISC_QUERIES,
]);
