import type { Topic } from '@pkgs/pubsub-shared/topic';
import { SYNC_ENGINE_WRITE_REJECTIONS } from './tables';
import { defineTopicMap } from './topic-map';
import type { TopicMap } from './topic-map';

/** Framework tables — product topic maps must not name these. */
export const FRAMEWORK_TOPIC_MAP = defineTopicMap({
  [SYNC_ENGINE_WRITE_REJECTIONS]: {
    topics(_row, ctx) {
      return [`user:${ctx.actorId}` as Topic];
    },
  },
});

/** Merge framework entries under product map (product wins on key clash). */
export function withFrameworkTopicMap(map?: TopicMap): TopicMap | undefined {
  if (map === undefined) return FRAMEWORK_TOPIC_MAP;
  return { ...FRAMEWORK_TOPIC_MAP, ...map };
}
