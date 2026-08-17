import { AUTH_QUERIES } from '@libs/auth/shared/queries/auth-queries';
import { CHESS_QUERIES } from '@libs/chess/shared/queries/chess-queries';
import { CLIENT_CONFIG_QUERIES } from '@libs/client-config/shared/queries/client-config-queries';
import { FRIENDS_QUERIES } from '@libs/friends/shared/queries/friends-queries';
import { NOTIFICATIONS_QUERIES } from '@libs/notifications/shared/notifications-queries';
import { PROFILE_QUERIES } from '@libs/profile/shared/queries/profile-queries';
import { SPACE_QUERIES } from '@libs/spaces/shared/queries/space-queries';
import { queryRegistry } from '@pkgs/sync-engine/shared';

export const APP_QUERIES = queryRegistry([
  ...AUTH_QUERIES,
  ...PROFILE_QUERIES,
  ...SPACE_QUERIES,
  ...FRIENDS_QUERIES,
  ...CHESS_QUERIES,
  ...CLIENT_CONFIG_QUERIES,
  ...NOTIFICATIONS_QUERIES,
]);
