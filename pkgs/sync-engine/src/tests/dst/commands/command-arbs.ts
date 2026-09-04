import fc from 'fast-check';

import type { DstAction, LibraryAction } from '../../../sim/dst/actions';
import type { DstApp } from '../../../sim/dst/app';
import type { WorldCmd, WorldCmd } from '../../../sim/dst/run-commands';
import {
  applyActionToModel,
  modelAllowsAction,
} from '../../../sim/dst/world-model';
import {
  chaosCommandArbs,
  connectivityCommandArbs,
  defaultClientIds,
  faultCommandArbs,
  lifecycleCommandArbs,
  networkCommandArbs,
} from './generators';

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

/** Weighted command pool for shrinking DST over World. */
export function buildWorldCommandPool(
  app: DstApp,
  clientIds: readonly string[]
): fc.Arbitrary<WorldCmd>[] {
  return [
    ...buildDomainCommandArbs(app, clientIds),
    ...buildLibraryCommandArbs(app, clientIds),
  ];
}

function buildDomainCommandArbs(
  app: DstApp,
  clientIds: readonly string[]
): fc.Arbitrary<WorldCmd>[] {
  const ids = defaultClientIds(clientIds);
  const domainArbs = app
    .domainOpArbs({ clientIds: ids })
    .map((arb) => arb.map((op) => actionCmd(app, op)));
  const serverArbs =
    app
      .serverOpArbs?.({ clientIds: ids })
      .map((arb) => arb.map((op) => actionCmd(app, op))) ?? [];
  return [...domainArbs, ...domainArbs, ...serverArbs];
}

function buildLibraryCommandArbs(
  app: DstApp,
  clientIds: readonly string[]
): fc.Arbitrary<WorldCmd>[] {
  return [
    ...buildConnectivityCommandArbs(app, clientIds),
    ...buildLifecycleChaosCommandArbs(app, clientIds),
  ];
}

function buildConnectivityCommandArbs(
  app: DstApp,
  clientIds: readonly string[]
): fc.Arbitrary<WorldCmd>[] {
  const ids = defaultClientIds(clientIds);
  const pickClient = fc.constantFrom(...ids);

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

  return [
    ...connectivityCommandArbs(pickClient, clientCmd),
    ...networkCommandArbs({
      pickClient,
      partitionCmd,
      holdCmd,
      releaseCmd,
      healCmd: actionCmd(app, { kind: 'heal' }),
      idleCmd: (ms) => actionCmd(app, { kind: 'idle', ms }),
    }),
    ...faultCommandArbs({
      pickClient,
      httpFaultCmd,
      crashAtCmd,
      publishCmd: (count) => actionCmd(app, { kind: 'publishFault', count }),
      authCmd: (c, status) =>
        actionCmd(app, { kind: 'auth', clientId: c, status }),
    }),
  ];
}

function buildLifecycleChaosCommandArbs(
  app: DstApp,
  clientIds: readonly string[]
): fc.Arbitrary<WorldCmd>[] {
  const ids = defaultClientIds(clientIds);
  const pickClient = fc.constantFrom(...ids);
  const sessionQuery = app.pack.sessionQuery;

  return [
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
      serverCrashCmd: actionCmd(app, { kind: 'serverCrash' }),
      serverRestartCmd: actionCmd(app, { kind: 'serverRestart' }),
    }),
    ...chaosCommandArbs({
      pickClient,
      pubsubFaultCmd: (fault) =>
        actionCmd(app, { kind: 'armPubsubFault', fault }),
      tamperCmd: (c, tamper) =>
        actionCmd(app, { kind: 'tamperLocalStorage', clientId: c, tamper }),
      schemaCmd: (c, variant) =>
        actionCmd(app, {
          kind: 'restartWithSchema',
          clientId: c,
          variant,
        }),
      protocolCutCmd: (c) =>
        actionCmd(app, { kind: 'protocolCut', clientId: c }),
      brokerCrashCmd: actionCmd(app, { kind: 'brokerCrash' }),
      brokerRestartCmd: actionCmd(app, { kind: 'brokerRestart' }),
      setFaultsCmd: (nodeId, traffic) =>
        actionCmd(app, {
          kind: 'setFaults',
          nodeId,
          traffic,
          faults: {
            packetLossProbability: 0.05,
            reorderWindow: 2,
            partitionProbability: 0.02,
          },
        }),
    }),
  ];
}
