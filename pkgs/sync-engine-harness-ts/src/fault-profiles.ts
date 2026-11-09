/**
 * Named bad-network profiles. One catalog every harness system can run
 * under: the `wire` part is a plain per-message hazard profile for the
 * framework network (`toKernelFaults(profile.wire)` → `network.setFaults`),
 * the rest tells the seeded adversary (`fault-adversary.ts`) how often to cut
 * a device off and which boundary failures to arm between steps.
 */

import type { HarnessFaultOptions } from './faults';
import { RELIABLE_FAULTS } from './faults';

/** A failure at the HTTP / push boundary the adversary can arm. */
export type BoundaryFault =
  | 'serverError'
  | 'rateLimited'
  | 'unauthorized'
  | 'forbidden'
  | 'captivePortal'
  | 'requestLost'
  | 'responseLost'
  | 'failedAfterCommit'
  | 'truncatedBody'
  | 'malformedBody'
  | 'malformedVerdicts'
  | 'pushDropped'
  | 'pushCorrupt'
  | 'pushDuplicated'
  | 'liveDisconnect';

export const BOUNDARY_FAULTS: readonly BoundaryFault[] = [
  'serverError',
  'rateLimited',
  'unauthorized',
  'forbidden',
  'captivePortal',
  'requestLost',
  'responseLost',
  'failedAfterCommit',
  'truncatedBody',
  'malformedBody',
  'malformedVerdicts',
  'pushDropped',
  'pushCorrupt',
  'pushDuplicated',
  'liveDisconnect',
];

export type FaultProfileName =
  | 'reliable'
  | 'fast'
  | 'slow'
  | 'offline'
  | 'flaky'
  | 'corrupt'
  | 'hostile';

export type FaultProfile = {
  readonly name: FaultProfileName;
  /** What a person would call this network. */
  readonly summary: string;
  /** Per-message hazards: latency, loss, duplication, reorder, partition. */
  readonly wire: HarnessFaultOptions;
  /**
   * Chance per adversary turn that one device loses its link, and the
   * longest the gap lasts. Half the gaps are announced to the app (the
   * device reports offline), half are silent (requests just vanish).
   */
  readonly offline: { readonly chance: number; readonly maxMs: number };
  /** Chance per turn of arming one fault drawn from `boundary`. */
  readonly boundaryChance: number;
  readonly boundary: readonly BoundaryFault[];
  /** Largest clock offset (either way) a device may be given; 0 = none. */
  readonly maxSkewMs: number;
};

const NO_OFFLINE = { chance: 0, maxMs: 0 } as const;

const HOUR_MS = 3_600_000;

export const FAULT_PROFILES: Readonly<Record<FaultProfileName, FaultProfile>> =
  {
    reliable: {
      name: 'reliable',
      summary: 'Instant, lossless network',
      wire: RELIABLE_FAULTS,
      offline: NO_OFFLINE,
      boundaryChance: 0,
      boundary: [],
      maxSkewMs: 0,
    },
    fast: {
      name: 'fast',
      summary: 'Fast network with small uneven delays',
      wire: { ...RELIABLE_FAULTS, latencyMeanMs: 2, latencyJitterMs: 2 },
      offline: NO_OFFLINE,
      boundaryChance: 0,
      boundary: [],
      maxSkewMs: 0,
    },
    slow: {
      name: 'slow',
      summary:
        'High latency: answers often arrive after the app stopped waiting',
      wire: {
        ...RELIABLE_FAULTS,
        latencyMeanMs: 1_800,
        latencyJitterMs: 1_500,
        reorderWindow: 4,
      },
      offline: NO_OFFLINE,
      boundaryChance: 0.2,
      boundary: ['truncatedBody', 'requestLost', 'responseLost'],
      maxSkewMs: 0,
    },
    offline: {
      name: 'offline',
      summary: 'Long stretches with no connection at all',
      wire: RELIABLE_FAULTS,
      offline: { chance: 0.5, maxMs: 90_000 },
      boundaryChance: 0,
      boundary: [],
      maxSkewMs: 0,
    },
    flaky: {
      name: 'flaky',
      summary: 'Intermittent drops, repeats and reordering; short outages',
      wire: {
        latencyMeanMs: 40,
        latencyJitterMs: 40,
        dropProbability: 0.15,
        packetReplayProbability: 0.1,
        reorderWindow: 4,
        partitionProbability: 0.02,
        healProbability: 0.2,
      },
      offline: { chance: 0.2, maxMs: 15_000 },
      boundaryChance: 0.3,
      boundary: [
        'requestLost',
        'responseLost',
        'serverError',
        'failedAfterCommit',
        'liveDisconnect',
        'pushDropped',
        'pushDuplicated',
      ],
      maxSkewMs: 0,
    },
    corrupt: {
      name: 'corrupt',
      summary: 'Answers arrive cut short, garbled, or from a Wi-Fi login page',
      wire: { ...RELIABLE_FAULTS, latencyMeanMs: 5, latencyJitterMs: 5 },
      offline: NO_OFFLINE,
      boundaryChance: 0.6,
      boundary: [
        'truncatedBody',
        'malformedBody',
        'malformedVerdicts',
        'captivePortal',
        'pushCorrupt',
      ],
      maxSkewMs: 0,
    },
    hostile: {
      name: 'hostile',
      summary: 'Everything at once, with clocks that disagree',
      wire: {
        latencyMeanMs: 120,
        latencyJitterMs: 200,
        dropProbability: 0.1,
        packetReplayProbability: 0.1,
        reorderWindow: 5,
        partitionProbability: 0.02,
        healProbability: 0.15,
      },
      offline: { chance: 0.25, maxMs: 60_000 },
      boundaryChance: 0.6,
      boundary: BOUNDARY_FAULTS,
      maxSkewMs: 2 * HOUR_MS,
    },
  };

export const FAULT_PROFILE_NAMES: readonly FaultProfileName[] = [
  'reliable',
  'fast',
  'slow',
  'offline',
  'flaky',
  'corrupt',
  'hostile',
];
