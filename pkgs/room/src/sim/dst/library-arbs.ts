import fc from 'fast-check';

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

export function defaultClientIds(
  clientIds: readonly string[]
): readonly string[] {
  return clientIds.length > 0 ? clientIds : [...CLIENT_IDS].slice(0, 2);
}

function sessionArbs(pick: PickClient): Arb[] {
  return [
    pick.map((clientId): LibraryAction => ({ kind: 'disconnect', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'connect', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'takeOver', clientId })),
  ];
}

function networkArbs(pick: PickClient): Arb[] {
  return [
    pick.map((clientId): LibraryAction => ({ kind: 'hold', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'release', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'down', clientId })),
    fc.constant<LibraryAction>({ kind: 'heal' }),
    fc
      .integer({ min: 1, max: 40 })
      .map((ms): LibraryAction => ({ kind: 'idle', ms })),
    pick.map(
      (clientId): LibraryAction => ({
        kind: 'setFaults',
        clientId,
        faults: MILD_NET_FAULTS,
      })
    ),
    pick.map(
      (clientId): LibraryAction => ({
        kind: 'asymmetricLink',
        clientId,
        link: { toClient: 'hold', toServer: 'ok' },
      })
    ),
  ];
}

function lifecycleArbs(pick: PickClient): Arb[] {
  return [
    pick.map((clientId): LibraryAction => ({ kind: 'crash', clientId })),
    pick.map((clientId): LibraryAction => ({ kind: 'restart', clientId })),
    pick.map(
      (clientId): LibraryAction => ({ kind: 'clearLocalData', clientId })
    ),
    fc.constant<LibraryAction>({ kind: 'serverCrash' }),
    fc.constant<LibraryAction>({ kind: 'serverRestart' }),
    fc.constant<LibraryAction>({
      kind: 'addSpectator',
      id: 'spec0',
      identity: 'spectator',
      clientId: 'spec-tab',
    }),
  ];
}

/**
 * Randomly generated {@link LibraryAction} shapes, one arbitrary per shape.
 * `armCrashAt` / `injectToServer` / `injectFromServer` / `setLink` stay out of
 * the pool — they need careful sequencing and are covered by scripted slices.
 */
export function libraryActionArbs(ctx: {
  readonly clientIds: readonly string[];
}): Arb[] {
  const pick = fc.constantFrom(...defaultClientIds(ctx.clientIds));
  return [...sessionArbs(pick), ...networkArbs(pick), ...lifecycleArbs(pick)];
}
