import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import { dispatchWorkloadAction } from '../../../domain-packs/notes-app/workload-dispatch';
import type { WorkloadAction } from '../../../domain-packs/notes-app/workload-types';
import type { SimWorld } from '../../../sim/world-api';
import { runActionWithInvariants } from '../world-config';
import {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CRASH_EVENTS,
  FOLDER_IDS,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
  NOTE_IDS,
  SPACE_IDS,
  type WorldModel,
  type WorldReal,
} from './model';

type WorldCmd = AsyncCommand<WorldModel, WorldReal>;

function actionCmd(action: WorkloadAction): WorldCmd {
  return {
    check: (m) => modelAllowsAction(m, action),
    run: async (m, r) => {
      applyActionToModel(m, action);
      r.actions.push(action);
    },
    toString: () => JSON.stringify(action),
  };
}

function mutateCmd(clientId: string, noteId: string, body: string): WorldCmd {
  return actionCmd({ kind: 'mutate', clientId, noteId, body });
}

function deleteNoteCmd(clientId: string, noteId: string): WorldCmd {
  return actionCmd({ kind: 'deleteNote', clientId, noteId });
}

function clientCmd(
  kind: Extract<
    WorkloadAction['kind'],
    | 'offline'
    | 'online'
    | 'disconnect'
    | 'connect'
    | 'background'
    | 'foreground'
  >,
  clientId: string
): WorldCmd {
  return actionCmd({ kind, clientId });
}

function partitionCmd(
  nodeId: string,
  traffic: 'live' | 'sync' | 'all'
): WorldCmd {
  return actionCmd({ kind: 'partition', nodeId, traffic });
}

function holdCmd(nodeId: string, traffic: 'live' | 'sync' | 'all'): WorldCmd {
  return actionCmd({ kind: 'hold', nodeId, traffic });
}

function releaseCmd(
  nodeId: string,
  traffic: 'live' | 'sync' | 'all'
): WorldCmd {
  return actionCmd({ kind: 'release', nodeId, traffic });
}

function httpFaultCmd(
  clientId: string,
  fault: (typeof HTTP_FAULTS)[number]
): WorldCmd {
  return actionCmd({ kind: 'armHttpFault', clientId, fault });
}

function crashAtCmd(
  clientId: string,
  event: (typeof CRASH_EVENTS)[number]
): WorldCmd {
  return actionCmd({ kind: 'armCrashAt', clientId, event });
}

function spaceCmd(
  kind: 'createSpace' | 'joinSpace' | 'leaveSpace',
  clientId: string,
  spaceId: string
): WorldCmd {
  return actionCmd({ kind, clientId, spaceId });
}

const clientArb = fc.constantFrom(...CLIENT_IDS);
const noteArb = fc.constantFrom(...NOTE_IDS);
const folderArb = fc.constantFrom(...FOLDER_IDS);
const spaceArb = fc.constantFrom(...SPACE_IDS);
const trafficArb = fc.constantFrom(...HOLD_TRAFFIC);

/** Weighted command generator for shrinking DST over SimWorld. */
export function worldCommands(
  clientIds: readonly string[],
  maxCommands = 14
): fc.Arbitrary<Iterable<WorldCmd>> {
  const ids = clientIds.length > 0 ? clientIds : [...CLIENT_IDS].slice(0, 2);
  const pickClient = fc.constantFrom(...ids);

  const mutateArbs = [
    fc
      .tuple(pickClient, noteArb, fc.string({ maxLength: 8 }))
      .map(([c, n, b]) => mutateCmd(c, n, b)),
    fc.tuple(pickClient, noteArb).map(([c, n]) => deleteNoteCmd(c, n)),
    fc.tuple(pickClient, noteArb).map(([c, n]) => mutateCmd(c, n, 'pbt')),
  ];

  const connectivityArbs = [
    pickClient.map((c) => clientCmd('offline', c)),
    pickClient.map((c) => clientCmd('online', c)),
    pickClient.map((c) => clientCmd('disconnect', c)),
    pickClient.map((c) => clientCmd('connect', c)),
    pickClient.map((c) => clientCmd('background', c)),
    pickClient.map((c) => clientCmd('foreground', c)),
  ];

  const networkArbs = [
    fc.tuple(pickClient, trafficArb).map(([c, t]) => partitionCmd(c, t)),
    fc.tuple(pickClient, trafficArb).map(([c, t]) => holdCmd(c, t)),
    fc.tuple(pickClient, trafficArb).map(([c, t]) => releaseCmd(c, t)),
    fc.constant(actionCmd({ kind: 'heal' })),
    fc
      .integer({ min: 1, max: 40 })
      .map((ms) => actionCmd({ kind: 'idle', ms })),
  ];

  const faultArbs = [
    fc
      .tuple(pickClient, fc.constantFrom(...HTTP_FAULTS))
      .map(([c, f]) => httpFaultCmd(c, f)),
    fc
      .tuple(pickClient, fc.constantFrom(...CRASH_EVENTS))
      .map(([c, e]) => crashAtCmd(c, e)),
    fc
      .constantFrom(1, 2, 'next' as const)
      .map((count) => actionCmd({ kind: 'publishFault', count })),
    fc
      .tuple(pickClient, fc.constantFrom(...AUTH_STATUSES))
      .map(([c, status]) => actionCmd({ kind: 'auth', clientId: c, status })),
  ];

  const domainArbs = [
    fc
      .tuple(pickClient, folderArb, fc.string({ maxLength: 6 }))
      .map(([c, f, title]) =>
        actionCmd({ kind: 'mutateFolder', clientId: c, folderId: f, title })
      ),
    fc
      .tuple(pickClient, spaceArb)
      .map(([c, s]) => spaceCmd('createSpace', c, s)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => spaceCmd('joinSpace', c, s)),
    fc
      .tuple(pickClient, spaceArb)
      .map(([c, s]) => spaceCmd('leaveSpace', c, s)),
    fc
      .tuple(noteArb, fc.string({ maxLength: 8 }))
      .map(([n, body]) =>
        actionCmd({ kind: 'writeNoteBodySilent', noteId: n, body })
      ),
    fc
      .tuple(noteArb, fc.string({ maxLength: 8 }))
      .map(([n, body]) =>
        actionCmd({ kind: 'insertCatalogNoteSilent', noteId: n, body })
      ),
  ];

  const lifecycleArbs = [
    pickClient.map((c) => actionCmd({ kind: 'crash', clientId: c })),
    pickClient.map((c) => actionCmd({ kind: 'restart', clientId: c })),
    pickClient.map((c) =>
      actionCmd({ kind: 'clearLocalData', clientId: c, reason: 'pbt' })
    ),
    pickClient.map((c) =>
      actionCmd({ kind: 'subscribe', clientId: c, queryName: 'notesWorld' })
    ),
    fc
      .tuple(
        fc.constantFrom(...ids, 'server'),
        fc.constantFrom(-60_000, 0, 60_000)
      )
      .map(([nodeId, skewMs]) => actionCmd({ kind: 'skew', nodeId, skewMs })),
  ];

  return fc.commands(
    [
      ...mutateArbs,
      ...mutateArbs,
      ...connectivityArbs,
      ...networkArbs,
      ...faultArbs,
      ...domainArbs,
      ...lifecycleArbs,
    ],
    {
      maxCommands,
      size: 'small',
    }
  );
}

export function initialWorldState(clientIds: readonly string[]): {
  model: WorldModel;
  real: WorldReal;
} {
  return {
    model: initialWorldModel(clientIds),
    real: { clientIds, actions: [] },
  };
}

/** Run recorded actions against a live world with per-step invariant checks. */
export async function replayActionsOnWorld(
  world: SimWorld,
  actions: readonly WorkloadAction[]
): Promise<void> {
  for (const action of actions) {
    await runActionWithInvariants(world, () =>
      dispatchWorkloadAction(world, action)
    );
  }
}

export {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CRASH_EVENTS,
  clientLive,
  FOLDER_IDS,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
  NOTE_IDS,
  SPACE_IDS,
} from './model';
export type { WorldCmd, WorldModel, WorldReal };
