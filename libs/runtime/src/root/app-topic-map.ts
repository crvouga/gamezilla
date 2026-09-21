import type { Topic } from '@pkgs/pubsub/interface';

import { userTopic } from '../public/sync-topics';
import { APP } from './app-features';

/** Product domain topic map — registered on API + client sync hosts. */
export const appTopicMap = APP.topicMap;

export function appDefaultEntryChannel(
  _params: unknown,
  ctx: { readonly actorId: string }
): Topic[] {
  return [userTopic(ctx.actorId)];
}
