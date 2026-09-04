import type { RoomFaultProfile } from '../network';

/** Mild fixed loss/reorder so `setFaults` perturbs without stalling sync. */
export const MILD_NET_FAULTS: RoomFaultProfile = {
  dropProbability: 0.05,
  reorderProbability: 0.1,
  latencyMeanMs: 5,
  latencyJitterMs: 5,
};

/** Mild net profiles the `setFaults` pool action draws from (reorder/dup included). */
export const NET_FAULT_PROFILES: readonly RoomFaultProfile[] = [
  MILD_NET_FAULTS,
  {
    latencyMeanMs: 5,
    latencyJitterMs: 5,
    dropProbability: 0.05,
  },
  {
    latencyMeanMs: 2,
    latencyJitterMs: 8,
    dropProbability: 0.1,
    reorderProbability: 0.15,
  },
  {
    latencyMeanMs: 0,
    latencyJitterMs: 0,
    dropProbability: 0.08,
    duplicateProbability: 0.1,
  },
  {
    latencyMeanMs: 10,
    latencyJitterMs: 10,
    dropProbability: 0.05,
    reorderProbability: 0.1,
    duplicateProbability: 0.05,
  },
];
