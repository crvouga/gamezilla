import type { Topic } from '@pkgs/pubsub/topic';

import type { SimCorruptionVariant } from './corruption-faults';
import type { SimPubsubFault } from './boundary-faults';

export type PubsubFaultArms = {
  readonly arm: (fault: SimPubsubFault) => void;
  readonly clear: () => void;
  readonly takeCorruption: () => SimCorruptionVariant | undefined;
  readonly shouldDropTopic: (topic: Topic) => boolean;
  readonly duplicatePublishCount: () => number;
};

export function createPubsubFaultArms(): PubsubFaultArms {
  let pubsubCorruption: SimCorruptionVariant | undefined;
  const topicDropRemaining = new Map<Topic, number>();
  let duplicatePublishRemaining = 0;

  return {
    arm(fault) {
      if (fault.kind === 'corruptPubsubPayload') {
        pubsubCorruption = fault.variant;
        return;
      }
      if (fault.kind === 'dropTopic') {
        topicDropRemaining.set(fault.topic, fault.count);
        return;
      }
      duplicatePublishRemaining = fault.count;
    },
    clear() {
      pubsubCorruption = undefined;
      topicDropRemaining.clear();
      duplicatePublishRemaining = 0;
    },
    takeCorruption() {
      if (pubsubCorruption === undefined) return undefined;
      const variant = pubsubCorruption;
      pubsubCorruption = undefined;
      return variant;
    },
    shouldDropTopic(topic) {
      const remaining = topicDropRemaining.get(topic);
      if (remaining === undefined || remaining <= 0) return false;
      topicDropRemaining.set(topic, remaining - 1);
      if (remaining - 1 <= 0) topicDropRemaining.delete(topic);
      return true;
    },
    duplicatePublishCount() {
      if (duplicatePublishRemaining <= 0) return 0;
      duplicatePublishRemaining -= 1;
      return 1;
    },
  };
}
