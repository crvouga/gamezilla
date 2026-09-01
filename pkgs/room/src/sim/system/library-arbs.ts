import fc from 'fast-check';

import { WORLD_PBT_CRASH_EVENTS } from '../boundary-faults';
import type { LibraryAction } from './actions';
import { CLIENT_IDS } from './world-model';

/** Mild fixed loss/reorder so `setFaults` perturbs without stalling sync. */
export const MILD_NET_FAULTS = {
  packetLossProbability: 0.05,
  reorderProbability: 0.1,
  oneWayDelayMeanMs: 5,
  oneWayDelayJitterMs: 5,
} as const;

type Arb = fc.Arbitrary<LibraryAction>;
type PickClient = fc.Arbitrary<string>;

export type LibraryArbEntry = {
  readonly kind: LibraryAction['kind'];
  readonly arb: (pick: PickClient) => Arb;
};

export function defaultClientIds(
  clientIds: readonly string[]
): readonly string[] {
  return clientIds.length > 0 ? clientIds : [...CLIENT_IDS].slice(0, 2);
}

/**
 * Randomly generated {@link LibraryAction} shapes — one entry per kind, one
 * `defineAction` each in `defineRoomSystem`.
 */
export const SAMPLED_LIBRARY_ARBS: readonly LibraryArbEntry[] = [
  {
    kind: 'disconnect',
    arb: (pick) => pick.map((clientId) => ({ kind: 'disconnect', clientId })),
  },
  {
    kind: 'connect',
    arb: (pick) => pick.map((clientId) => ({ kind: 'connect', clientId })),
  },
  {
    kind: 'takeOver',
    arb: (pick) => pick.map((clientId) => ({ kind: 'takeOver', clientId })),
  },
  {
    kind: 'hold',
    arb: (pick) => pick.map((clientId) => ({ kind: 'hold', clientId })),
  },
  {
    kind: 'release',
    arb: (pick) => pick.map((clientId) => ({ kind: 'release', clientId })),
  },
  {
    kind: 'down',
    arb: (pick) => pick.map((clientId) => ({ kind: 'down', clientId })),
  },
  { kind: 'heal', arb: () => fc.constant<LibraryAction>({ kind: 'heal' }) },
  {
    kind: 'idle',
    arb: () =>
      fc.integer({ min: 1, max: 40 }).map((ms) => ({ kind: 'idle', ms })),
  },
  {
    kind: 'setFaults',
    arb: (pick) =>
      pick.map((clientId) => ({
        kind: 'setFaults',
        clientId,
        faults: MILD_NET_FAULTS,
      })),
  },
  {
    kind: 'asymmetricLink',
    arb: (pick) =>
      pick.map((clientId) => ({
        kind: 'asymmetricLink',
        clientId,
        link: { toClient: 'hold', toServer: 'ok' },
      })),
  },
  {
    kind: 'crash',
    arb: (pick) => pick.map((clientId) => ({ kind: 'crash', clientId })),
  },
  {
    kind: 'restart',
    arb: (pick) => pick.map((clientId) => ({ kind: 'restart', clientId })),
  },
  {
    kind: 'clearLocalData',
    arb: (pick) =>
      pick.map((clientId) => ({ kind: 'clearLocalData', clientId })),
  },
  {
    kind: 'serverCrash',
    arb: () => fc.constant<LibraryAction>({ kind: 'serverCrash' }),
  },
  {
    kind: 'serverRestart',
    arb: () => fc.constant<LibraryAction>({ kind: 'serverRestart' }),
  },
  {
    kind: 'addSpectator',
    arb: () =>
      fc.constant<LibraryAction>({
        kind: 'addSpectator',
        id: 'spec0',
        identity: 'spectator',
        clientId: 'spec-tab',
      }),
  },
];

/**
 * Scripted-only kinds — they need careful sequencing, so they never enter the
 * generated pool (their action defs gate `allows` to false). They still get an
 * action def so `replay` / scripted pins can dispatch them.
 */
export const SCRIPTED_LIBRARY_ARBS: readonly LibraryArbEntry[] = [
  {
    kind: 'armCrashAt',
    arb: (pick) =>
      fc
        .tuple(pick, fc.constantFrom(...WORLD_PBT_CRASH_EVENTS))
        .map(([clientId, event]) => ({ kind: 'armCrashAt', clientId, event })),
  },
  {
    kind: 'injectToServer',
    arb: (pick) =>
      pick.map((clientId) => ({ kind: 'injectToServer', clientId, raw: null })),
  },
  {
    kind: 'injectFromServer',
    arb: (pick) =>
      pick.map((clientId) => ({
        kind: 'injectFromServer',
        clientId,
        raw: null,
      })),
  },
  {
    kind: 'setLink',
    arb: (pick) =>
      pick.map((clientId) => ({ kind: 'setLink', clientId, link: 'ok' })),
  },
];
