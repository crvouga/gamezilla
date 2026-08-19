import { AUTH_TOPIC_MAP } from '@libs/auth/public/topic-map';
import { CHESS_TOPIC_MAP } from '@libs/chess/public/topic-map';
import { CLIENT_CONFIG_TOPIC_MAP } from '@libs/client-config/public/topic-map';
import { FRIENDS_TOPIC_MAP } from '@libs/friends/public/topic-map';
import { NOTIFICATIONS_TOPIC_MAP } from '@libs/notifications/public/topic-map';
import { PROFILE_TOPIC_MAP } from '@libs/profile/public/topic-map';
import { SPACES_TOPIC_MAP } from '@libs/spaces/public/topic-map';
import type { Topic } from '@pkgs/pubsub/interface';
import { defineTopicMap } from '@pkgs/sync-engine/shared';
import { userTopic } from '../public/sync-topics';

/** Product domain topic map — registered on API + client sync hosts. */
export const appTopicMap = defineTopicMap({
  ...AUTH_TOPIC_MAP,
  ...SPACES_TOPIC_MAP,
  ...FRIENDS_TOPIC_MAP,
  ...PROFILE_TOPIC_MAP,
  ...CHESS_TOPIC_MAP,
  ...CLIENT_CONFIG_TOPIC_MAP,
  ...NOTIFICATIONS_TOPIC_MAP,
});

export function appDefaultEntryChannel(
  _params: unknown,
  ctx: { readonly actorId: string }
): Topic[] {
  return [userTopic(ctx.actorId)];
}
