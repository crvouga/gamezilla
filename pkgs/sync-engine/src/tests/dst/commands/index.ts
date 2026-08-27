import fc from 'fast-check';

import type { SimWorld } from '../../../sim/world-api';
import type { DstAction, LibraryAction } from '../actions';
import type { DstApp } from '../app';
import { dispatchDstAction } from '../dispatch';
import {
  applyActionToModel,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
  type WorldReal,
} from '../model';
import {
  connectivityCommandArbs,
  defaultClientIds,
  faultCommandArbs,
  lifecycleCommandArbs,
  networkCommandArbs,
} from './generators';
import type { WorldCmd } from './index-types';

/** Skew arms are fire-and-forget in replay — zero before settle. */
export function resetClockSkews(world: SimWorld): void {
  world.node('server').skewClock(0);
  for (const id of world.clients.keys()) {
    world.node(id).skewClock(0);
  }
}

/** Clear partitions/holds/faults so restart and sync can complete. */
function healNetworkForSettle(world: SimWorld): void {
  world.network.releaseAll();
  world.network.healAll();
  world.network.clearNodeFaults();
}

async function restartClientForConverge(
  world: SimWorld,
  clientId: string
): Promise<void> {
  world.node(clientId).auth('valid');
  await world.node(clientId).restart({ preserveLocalDb: true });
}

function actionCmd(app: DstApp, action: DstAction): WorldCmd {
  return {
    check: (m) => modelAllowsAction(app, m, action),
    run: async (m, r) => {
      applyActionToModel(app, m, action);
      r.actions.push(action);
    },
    toString: () => JSON.stringify(action),
  };
}

function cmdHelpers(app: DstApp) {
  const clientCmd = (
    kind: Extract<
      LibraryAction['kind'],
      | 'offline'
      | 'online'
      | 'disconnect'
      | 'connect'
      | 'background'
      | 'foreground'
    >,
    clientId: string
  ) => actionCmd(app, { kind, clientId });
  const partitionCmd = (nodeId: string, traffic: 'live' | 'sync' | 'all') =>
    actionCmd(app, { kind: 'partition', nodeId, traffic });
  const holdCmd = (nodeId: string, traffic: 'live' | 'sync' | 'all') =>
    actionCmd(app, { kind: 'hold', nodeId, traffic });
  const releaseCmd = (nodeId: string, traffic: 'live' | 'sync' | 'all') =>
    actionCmd(app, { kind: 'release', nodeId, traffic });
  const httpFaultCmd = (
    clientId: string,
    fault: Extract<LibraryAction, { kind: 'armHttpFault' }>['fault']
  ) => actionCmd(app, { kind: 'armHttpFault', clientId, fault });
  const crashAtCmd = (
    clientId: string,
    event: Extract<LibraryAction, { kind: 'armCrashAt' }>['event']
  ) => actionCmd(app, { kind: 'armCrashAt', clientId, event });

  return {
    clientCmd,
    partitionCmd,
    holdCmd,
    releaseCmd,
    httpFaultCmd,
    crashAtCmd,
  };
}

/** Weighted command generator for shrinking DST over SimWorld. */
export function worldCommands(
  app: DstApp,
  clientIds: readonly string[],
  maxCommands = 14
): fc.Arbitrary<Iterable<WorldCmd>> {
  const ids = defaultClientIds(clientIds);
  const pickClient = fc.constantFrom(...ids);
  const h = cmdHelpers(app);
  const sessionQuery = app.pack.sessionQuery;

  const domainArbs = app
    .domainOpArbs({ clientIds: ids })
    .map((arb) => arb.map((op) => actionCmd(app, op)));
  const serverArbs =
    app
      .serverOpArbs?.({ clientIds: ids })
      .map((arb) => arb.map((op) => actionCmd(app, op))) ?? [];

  const all = [
    ...domainArbs,
    ...domainArbs,
    ...connectivityCommandArbs(pickClient, h.clientCmd),
    ...networkCommandArbs({
      pickClient,
      partitionCmd: h.partitionCmd,
      holdCmd: h.holdCmd,
      releaseCmd: h.releaseCmd,
      healCmd: actionCmd(app, { kind: 'heal' }),
      idleCmd: (ms) => actionCmd(app, { kind: 'idle', ms }),
    }),
    ...faultCommandArbs({
      pickClient,
      httpFaultCmd: h.httpFaultCmd,
      crashAtCmd: h.crashAtCmd,
      publishCmd: (count) => actionCmd(app, { kind: 'publishFault', count }),
      authCmd: (c, status) =>
        actionCmd(app, { kind: 'auth', clientId: c, status }),
    }),
    ...serverArbs,
    ...lifecycleCommandArbs({
      ids,
      pickClient,
      crashCmd: (c) => actionCmd(app, { kind: 'crash', clientId: c }),
      restartCmd: (c) => actionCmd(app, { kind: 'restart', clientId: c }),
      clearCmd: (c) =>
        actionCmd(app, {
          kind: 'clearLocalData',
          clientId: c,
          reason: 'pbt',
        }),
      subscribeCmd: (c) =>
        actionCmd(app, {
          kind: 'subscribe',
          clientId: c,
          queryName: sessionQuery.name,
          params: sessionQuery.params,
        }),
      skewCmd: (nodeId, skewMs) =>
        actionCmd(app, { kind: 'skew', nodeId, skewMs }),
    }),
  ];

  return fc.commands(all, { maxCommands, size: 'small' });
}

export function initialWorldState(
  app: DstApp,
  clientIds: readonly string[]
): {
  model: WorldModel;
  real: WorldReal;
} {
  return {
    model: initialWorldModel(app, clientIds),
    real: { clientIds, actions: [] },
  };
}

/** Run recorded actions against a live world with per-step invariant checks. */
export async function replayActionsOnWorld(
  app: DstApp,
  world: SimWorld,
  actions: readonly DstAction[]
): Promise<void> {
  const needsRestart = new Set<string>();
  for (const action of actions) {
    const aliveBefore = new Set(world.clients.keys());
    if (action.kind === 'restart') {
      healNetworkForSettle(world);
    }
    await dispatchDstAction(world, app, action);

    for (const id of aliveBefore) {
      if (!world.clients.has(id)) {
        needsRestart.add(id);
      }
    }

    if (action.kind === 'auth' && action.status === 'revoked') {
      needsRestart.add(action.clientId);
    }
    if (action.kind === 'crash') {
      needsRestart.add(action.clientId);
    }
    if (action.kind === 'connect' && needsRestart.has(action.clientId)) {
      healNetworkForSettle(world);
      await restartClientForConverge(world, action.clientId);
      needsRestart.delete(action.clientId);
    } else if (action.kind === 'restart') {
      needsRestart.delete(action.clientId);
      await assertStepInvariants(world);
    } else {
      await assertStepInvariants(world);
    }
  }
  await prepareClientsForConverge(app, world, needsRestart);
}

async function assertStepInvariants(world: SimWorld): Promise<void> {
  const inv = await world.checkInvariants();
  if (inv !== null) {
    throw new Error(
      `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
    );
  }
  await world.runFor(10);
}

/** Revoked/crashed clients may hold a closed DB — restart before settle. */
export async function prepareClientsForConverge(
  app: DstApp,
  world: SimWorld,
  clientIds: Iterable<string>
): Promise<void> {
  const ids = [...clientIds];
  if (ids.length === 0) return;
  await dispatchDstAction(world, app, { kind: 'heal' });
  healNetworkForSettle(world);
  resetClockSkews(world);
  for (const id of ids) {
    await restartClientForConverge(world, id);
  }
  if (world.clients.size > 0) {
    await world.runFor(50);
  }
}

export {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CRASH_EVENTS,
  clientLive,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
} from '../model';
export type { WorldCmd, WorldModel, WorldReal };
