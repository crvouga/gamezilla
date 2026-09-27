import type { Topic } from '@pkgs/pubsub/topic';
import type { SimCorruptionVariant } from './corruption-faults';

export type SimPubsubFault =
  | {
      readonly kind: 'corruptPubsubPayload';
      readonly variant: SimCorruptionVariant;
      /** Only the next publish on this topic (default: the next publish). */
      readonly topic?: Topic;
    }
  | {
      readonly kind: 'dropTopic';
      readonly topic: Topic;
      readonly count: number;
    }
  | {
      readonly kind: 'duplicatePublish';
      readonly count: number;
    };

export type PubsubFaultArms = {
  readonly arm: (fault: SimPubsubFault) => void;
  readonly clear: () => void;
  readonly takeCorruption: (topic: Topic) => SimCorruptionVariant | undefined;
  readonly shouldDropTopic: (topic: Topic) => boolean;
  readonly duplicatePublishCount: () => number;
};

export function createPubsubFaultArms(): PubsubFaultArms {
  let pubsubCorruption:
    | { readonly variant: SimCorruptionVariant; readonly topic?: Topic }
    | undefined;
  const topicDropRemaining = new Map<Topic, number>();
  let duplicatePublishRemaining = 0;

  return {
    arm(fault) {
      if (fault.kind === 'corruptPubsubPayload') {
        pubsubCorruption =
          fault.topic === undefined
            ? { variant: fault.variant }
            : { variant: fault.variant, topic: fault.topic };
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
    takeCorruption(topic) {
      if (pubsubCorruption === undefined) return undefined;
      const armed = pubsubCorruption;
      if (armed.topic !== undefined && armed.topic !== topic) return undefined;
      pubsubCorruption = undefined;
      return armed.variant;
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
