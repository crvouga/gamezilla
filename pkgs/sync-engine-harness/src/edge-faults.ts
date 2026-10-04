/**
 * Boundary-level crash and HTTP fault arms for the deterministic harness.
 * Named after observable behavior — never after internal engine modules.
 */

import type { Topic } from '@pkgs/pubsub-shared/topic';
import type { HarnessCorruptionVariant } from './corruption-faults';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import { createPubsubFaultArms } from './edge-fault-pubsub';

export type HarnessCrashEvent =
  | 'afterNextSyncResponseDelivered'
  | 'afterNextMutateResolved'
  | 'afterNextMutationsPostAccepted'
  | 'onNextTimerTickWhileSyncUndelivered'
  | 'onNextEngineOpenAfterCacheWipe';

export type HarnessHttpFault =
  | {
      readonly kind: 'dropMutationsResponse';
    }
  | {
      readonly kind: 'dropQueryResponse';
    }
  | {
      readonly kind: 'failMutationsAfterCommit';
    }
  | {
      readonly kind: 'failMutationsInsideTxnAfter';
      readonly after: number;
    }
  | {
      readonly kind: 'invalidMutationsBody';
    }
  | {
      readonly kind: 'serverErrorOnNext';
      readonly route: 'mutations' | 'query';
    }
  | {
      readonly kind: 'corruptMutationsResponse';
      readonly variant: HarnessCorruptionVariant;
    }
  | {
      readonly kind: 'corruptQueryResponse';
      readonly variant: HarnessCorruptionVariant;
    }
  | {
      readonly kind: 'rateLimited';
      readonly route: 'mutations' | 'query';
      readonly retryAfterMs: number;
    }
  | {
      readonly kind: 'abortResponseBody';
      readonly route: 'mutations' | 'query';
    }
  | { readonly kind: 'batchTooLarge' }
  | {
      readonly kind: 'authExpiredInFlight';
      readonly route: 'mutations' | 'query';
    };

export type EdgeFaultController = {
  readonly armCrash: (nodeId: string, event: HarnessCrashEvent) => void;
  readonly clearCrashArms: (nodeId?: string) => void;
  readonly takeCrash: (nodeId: string, event: HarnessCrashEvent) => boolean;
  readonly armHttpFault: (nodeId: string, fault: HarnessHttpFault) => void;
  readonly clearHttpFaults: (nodeId?: string) => void;
  readonly takeHttpFault: (
    nodeId: string,
    kind: HarnessHttpFault['kind']
  ) => HarnessHttpFault | undefined;
  readonly peekHttpFault: (
    nodeId: string,
    kind: HarnessHttpFault['kind']
  ) => HarnessHttpFault | undefined;
  readonly armPublishFault: (count: number | 'next') => void;
  readonly clearPublishFault: () => void;
  /** Returns true when a publish should be suppressed / fail. */
  readonly takePublishFault: () => boolean;
  readonly armPubsubFault: (fault: HarnessPubsubFault) => void;
  readonly clearPubsubFaults: () => void;
  readonly takePubsubCorruption: (
    topic: Topic
  ) => HarnessCorruptionVariant | undefined;
  readonly shouldDropTopic: (topic: Topic) => boolean;
  readonly duplicatePublishCount: () => number;
};

/** In-memory one-shot fault arms keyed by node id. */
export function createBoundaryFaultController(): EdgeFaultController {
  const crashes = new Map<string, Set<HarnessCrashEvent>>();
  const httpFaults = new Map<string, HarnessHttpFault[]>();
  let publishRemaining = 0;
  const pubsub = createPubsubFaultArms();

  return {
    armCrash(nodeId, event) {
      let set = crashes.get(nodeId);
      if (set === undefined) {
        set = new Set();
        crashes.set(nodeId, set);
      }
      set.add(event);
    },
    clearCrashArms(nodeId) {
      if (nodeId === undefined) {
        crashes.clear();
        return;
      }
      crashes.delete(nodeId);
    },
    takeCrash(nodeId, event) {
      const set = crashes.get(nodeId);
      if (set === undefined || !set.has(event)) return false;
      set.delete(event);
      if (set.size === 0) crashes.delete(nodeId);
      return true;
    },
    armHttpFault(nodeId, fault) {
      const list = httpFaults.get(nodeId) ?? [];
      list.push(fault);
      httpFaults.set(nodeId, list);
    },
    clearHttpFaults(nodeId) {
      if (nodeId === undefined) {
        httpFaults.clear();
        return;
      }
      httpFaults.delete(nodeId);
    },
    takeHttpFault(nodeId, kind) {
      const list = httpFaults.get(nodeId);
      if (list === undefined) return undefined;
      const idx = list.findIndex((f) => f.kind === kind);
      if (idx < 0) return undefined;
      const [fault] = list.splice(idx, 1);
      if (list.length === 0) httpFaults.delete(nodeId);
      return fault;
    },
    peekHttpFault(nodeId, kind) {
      const list = httpFaults.get(nodeId);
      if (list === undefined) return undefined;
      return list.find((f) => f.kind === kind);
    },
    armPublishFault(count) {
      publishRemaining = count === 'next' ? 1 : Math.max(0, count);
    },
    clearPublishFault() {
      publishRemaining = 0;
    },
    takePublishFault() {
      if (publishRemaining <= 0) return false;
      publishRemaining -= 1;
      return true;
    },
    armPubsubFault(fault) {
      pubsub.arm(fault);
    },
    clearPubsubFaults() {
      pubsub.clear();
    },
    takePubsubCorruption: (topic) => pubsub.takeCorruption(topic),
    shouldDropTopic: (topic) => pubsub.shouldDropTopic(topic),
    duplicatePublishCount: () => pubsub.duplicatePublishCount(),
  };
}
