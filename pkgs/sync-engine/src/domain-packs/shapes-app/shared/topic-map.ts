import { defineTopicMap } from '../../../shared/topic-map';
import { SHAPES_WORLD_TOPIC } from './topics';

export const shapesTopicMap = defineTopicMap({
  shapes: {
    topics() {
      return [SHAPES_WORLD_TOPIC];
    },
  },
});

export function shapesDefaultEntryChannel() {
  return [SHAPES_WORLD_TOPIC];
}
