import fc from 'fast-check';

import type { LibraryAction, RoomDstAction } from '../actions';
import type { RoomDstApp } from '../app';
import { applyActionToModel, modelAllowsAction } from '../model';
import type { WorldCmd } from './index-types';

function actionCmd(app: RoomDstApp, action: RoomDstAction): WorldCmd {
  return {
    check: (m) => modelAllowsAction(app, m, action),
    run: async (m, r) => {
      applyActionToModel(app, m, action);
      r.actions.push(action);
    },
    toString: () => JSON.stringify(action),
  };
}

export function defaultClientIds(clientIds: readonly string[]): string[] {
  return clientIds.length > 0 ? [...clientIds] : ['c0', 'c1'];
}

/** Weighted command pool for shrinking DST over World. */
export function buildWorldCommandPool(
  app: RoomDstApp,
  clientIds: readonly string[]
): fc.Arbitrary<WorldCmd>[] {
  const ids = defaultClientIds(clientIds);
  const pickClient = fc.constantFrom(...ids);

  const domainArbs = app
    .domainOpArbs({ clientIds: ids })
    .map((arb) => arb.map((op) => actionCmd(app, op)));

  // armCrashAt stays out of the random pool (scripted / slice PBTs only) —
  // sync-engine excludes arms that need careful sequencing from fc.commands.
  const libraryArbs: fc.Arbitrary<WorldCmd>[] = [
    pickClient.map((c) => actionCmd(app, { kind: 'disconnect', clientId: c })),
    pickClient.map((c) => actionCmd(app, { kind: 'connect', clientId: c })),
    pickClient.map((c) => actionCmd(app, { kind: 'hold', clientId: c })),
    pickClient.map((c) => actionCmd(app, { kind: 'release', clientId: c })),
    pickClient.map((c) => actionCmd(app, { kind: 'down', clientId: c })),
    fc.constant(actionCmd(app, { kind: 'heal' })),
    fc
      .integer({ min: 1, max: 40 })
      .map((ms) => actionCmd(app, { kind: 'idle', ms })),
    pickClient.map((c) => actionCmd(app, { kind: 'takeOver', clientId: c })),
    pickClient.map((c) => actionCmd(app, { kind: 'crash', clientId: c })),
    pickClient.map((c) => actionCmd(app, { kind: 'restart', clientId: c })),
    fc.constant(actionCmd(app, { kind: 'serverCrash' })),
    fc.constant(actionCmd(app, { kind: 'serverRestart' })),
    pickClient.map((c) =>
      actionCmd(app, { kind: 'clearLocalData', clientId: c })
    ),
    pickClient.map((c) =>
      actionCmd(app, {
        kind: 'setFaults',
        clientId: c,
        faults: {
          packetLossProbability: 0.05,
          reorderProbability: 0.1,
          oneWayDelayMeanMs: 5,
          oneWayDelayJitterMs: 5,
        },
      })
    ),
    pickClient.map((c) =>
      actionCmd(app, {
        kind: 'asymmetricLink',
        clientId: c,
        link: { toClient: 'hold', toServer: 'ok' },
      })
    ),
    fc.constant(
      actionCmd(app, {
        kind: 'addSpectator',
        id: 'spec0',
        identity: 'spectator',
        clientId: 'spec-tab',
      })
    ),
  ];

  // Domain ops weighted 2× like sync-engine.
  return [...domainArbs, ...domainArbs, ...libraryArbs];
}

export type { LibraryAction };
