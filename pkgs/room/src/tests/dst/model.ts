import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import { WORLD_PBT_CRASH_EVENTS } from '../../sim/boundary-faults';
import type { RoomFaultProfile } from '../../sim/network';
import { ROOM_ERROR_TYPE } from '../../types';
import type { DomainOp, LibraryAction, RoomDstAction } from './actions';
import type { RoomDstApp } from './app';

export type WorldModel = {
  readonly clientIds: readonly string[];
  sessionConnected: Set<string>;
  held: Set<string>;
  down: Set<string>;
  crashed: Set<string>;
  /** Clients armed with afterNextCommitted / afterNextCommandAck. */
  armedCommitted: Set<string>;
  armedCommandAck: Set<string>;
  serverCrashed: boolean;
  spectatorCount: number;
  mutations: number;
  domain: unknown;
};

export type WorldReal = {
  readonly clientIds: readonly string[];
  readonly actions: RoomDstAction[];
};

export const CLIENT_IDS = ['c0', 'c1', 'c2'] as const;

export { WORLD_PBT_CRASH_EVENTS };

/** Mild net profiles for catalog PBTs (includes reorder/dup). */
export const NET_FAULT_PROFILES: readonly RoomFaultProfile[] = [
  {
    oneWayDelayMeanMs: 5,
    oneWayDelayJitterMs: 5,
    packetLossProbability: 0.05,
  },
  {
    oneWayDelayMeanMs: 2,
    oneWayDelayJitterMs: 8,
    packetLossProbability: 0.1,
    reorderProbability: 0.15,
  },
  {
    oneWayDelayMeanMs: 0,
    oneWayDelayJitterMs: 0,
    packetLossProbability: 0.08,
    duplicateProbability: 0.1,
  },
  {
    oneWayDelayMeanMs: 10,
    oneWayDelayJitterMs: 10,
    packetLossProbability: 0.05,
    reorderProbability: 0.1,
    duplicateProbability: 0.05,
  },
] as const;

export type ByzantineInjectKind =
  | 'malformed'
  | 'unknownKind'
  | 'staleSync'
  | 'ping'
  | 'forgedCommitted'
  | 'staleWelcome'
  | 'forgedRejected'
  | 'forgedRoster'
  | 'garbagePong';

export const BYZANTINE_INJECT_KINDS: readonly ByzantineInjectKind[] = [
  'malformed',
  'unknownKind',
  'staleSync',
  'ping',
  'forgedCommitted',
  'staleWelcome',
  'forgedRejected',
  'forgedRoster',
  'garbagePong',
] as const;

export function buildByzantineRaw(
  kind: ByzantineInjectKind,
  now: number
): { readonly direction: 'toServer' | 'toClient'; readonly raw: unknown } {
  switch (kind) {
    case 'malformed':
      return { direction: 'toServer', raw: 'not-json-object' };
    case 'unknownKind':
      return {
        direction: 'toServer',
        raw: { v: WIRE_VERSION, kind: 'nope' },
      };
    case 'staleSync':
      return {
        direction: 'toServer',
        raw: { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.sync, fromSeq: 999 },
      };
    case 'ping':
      return {
        direction: 'toServer',
        raw: { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.ping },
      };
    case 'forgedCommitted':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.committed,
          commandId: 'forged',
          entries: [
            {
              seq: 99,
              event: {
                type: 'space-counter-evt/counter-incremented',
                payload: {},
              },
              actor: { id: 'eve', clientId: 'eve' },
              ts: now,
            },
          ],
        },
      };
    case 'staleWelcome':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.welcome,
          fromSeq: 0,
          lastSeq: 0,
          entries: [],
        },
      };
    case 'forgedRejected':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.rejected,
          commandId: 'ghost',
          error: {
            type: ROOM_ERROR_TYPE.invalidCommand,
            reason: 'forged',
          },
        },
      };
    case 'forgedRoster':
      return {
        direction: 'toClient',
        raw: {
          v: WIRE_VERSION,
          kind: ROOM_WIRE_KIND.roster,
          clients: [{ id: 'ghost', clientId: 'ghost' }],
        },
      };
    case 'garbagePong':
      return {
        direction: 'toClient',
        raw: { v: WIRE_VERSION, kind: ROOM_WIRE_KIND.pong },
      };
  }
}

export function initialWorldModel(
  app: RoomDstApp,
  clientIds: readonly string[]
): WorldModel {
  return {
    clientIds,
    sessionConnected: new Set(clientIds),
    held: new Set(),
    down: new Set(),
    crashed: new Set(),
    armedCommitted: new Set(),
    armedCommandAck: new Set(),
    serverCrashed: false,
    spectatorCount: 0,
    mutations: 0,
    domain: app.domainModel?.initial() ?? null,
  };
}

export function clientLive(m: WorldModel, clientId: string): boolean {
  return (
    m.sessionConnected.has(clientId) &&
    !m.crashed.has(clientId) &&
    !m.serverCrashed
  );
}

function markCrashed(m: WorldModel, clientId: string): void {
  m.crashed.add(clientId);
  m.sessionConnected.delete(clientId);
  m.armedCommitted.delete(clientId);
  m.armedCommandAck.delete(clientId);
}

/** After a domain commit, trip arms for clients that can receive the frame. */
function tripCommittedArms(m: WorldModel, actorId: string): void {
  for (const id of [...m.armedCommitted]) {
    if (m.down.has(id) || m.held.has(id) || m.crashed.has(id)) continue;
    markCrashed(m, id);
  }
  if (
    m.armedCommandAck.has(actorId) &&
    !m.down.has(actorId) &&
    !m.held.has(actorId)
  ) {
    markCrashed(m, actorId);
  }
}

function applyLibraryToModel(m: WorldModel, action: LibraryAction): void {
  switch (action.kind) {
    case 'disconnect':
      m.sessionConnected.delete(action.clientId);
      break;
    case 'connect':
      m.sessionConnected.add(action.clientId);
      break;
    case 'hold':
      m.held.add(action.clientId);
      m.down.delete(action.clientId);
      break;
    case 'release':
      m.held.delete(action.clientId);
      break;
    case 'down':
      m.down.add(action.clientId);
      m.held.delete(action.clientId);
      break;
    case 'heal':
      m.held.clear();
      m.down.clear();
      break;
    case 'crash':
      markCrashed(m, action.clientId);
      break;
    case 'restart':
      m.crashed.delete(action.clientId);
      m.sessionConnected.add(action.clientId);
      break;
    case 'serverCrash':
      m.serverCrashed = true;
      break;
    case 'serverRestart':
      m.serverCrashed = false;
      break;
    case 'armCrashAt':
      if (action.event === 'afterNextCommitted') {
        m.armedCommitted.add(action.clientId);
      } else if (action.event === 'afterNextCommandAck') {
        m.armedCommandAck.add(action.clientId);
      }
      break;
    case 'clearLocalData':
      break;
    case 'addSpectator':
      m.spectatorCount += 1;
      break;
    case 'setLink':
      if (action.link === 'hold') {
        m.held.add(action.clientId);
        m.down.delete(action.clientId);
      } else if (action.link === 'down') {
        m.down.add(action.clientId);
        m.held.delete(action.clientId);
      } else {
        m.held.delete(action.clientId);
        m.down.delete(action.clientId);
      }
      break;
    default:
      break;
  }
}

export function applyActionToModel(
  app: RoomDstApp,
  m: WorldModel,
  action: RoomDstAction
): void {
  if (action.kind === 'domain') {
    m.mutations += 1;
    app.domainModel?.apply(m.domain, action);
    tripCommittedArms(m, action.clientId);
    return;
  }
  applyLibraryToModel(m, action);
  if (action.kind === 'heal') {
    app.domainModel?.onHeal?.(m.domain);
  }
}

function libraryAllowsAction(m: WorldModel, action: LibraryAction): boolean {
  switch (action.kind) {
    case 'disconnect':
      return (
        m.sessionConnected.has(action.clientId) &&
        !m.crashed.has(action.clientId)
      );
    case 'connect':
      return (
        !m.sessionConnected.has(action.clientId) &&
        !m.crashed.has(action.clientId)
      );
    case 'hold':
      return !m.held.has(action.clientId) && !m.crashed.has(action.clientId);
    case 'release':
      return m.held.has(action.clientId);
    case 'down':
      return !m.down.has(action.clientId) && !m.crashed.has(action.clientId);
    case 'heal':
      return m.held.size > 0 || m.down.size > 0;
    case 'takeOver':
      return clientLive(m, action.clientId);
    case 'crash':
      return !m.crashed.has(action.clientId);
    case 'restart':
      return m.crashed.has(action.clientId);
    case 'serverCrash':
      return !m.serverCrashed;
    case 'serverRestart':
      return m.serverCrashed;
    case 'clearLocalData':
      return !m.crashed.has(action.clientId);
    case 'armCrashAt':
      return clientLive(m, action.clientId);
    case 'injectToServer':
    case 'injectFromServer':
      return !m.crashed.has(action.clientId);
    case 'setFaults':
    case 'asymmetricLink':
    case 'setLink':
      return !m.crashed.has(action.clientId);
    case 'addSpectator':
      return m.spectatorCount < 2;
    case 'idle':
      return true;
    default:
      return true;
  }
}

export function modelAllowsAction(
  app: RoomDstApp,
  m: WorldModel,
  action: RoomDstAction
): boolean {
  if (action.kind === 'domain') {
    if (!clientLive(m, action.clientId)) return false;
    if (app.domainModel?.clientAllows !== undefined) {
      return app.domainModel.clientAllows(m.domain, action, true);
    }
    return app.domainModel?.allows(m.domain, action) ?? true;
  }
  return libraryAllowsAction(m, action);
}

export function domainOp(
  clientId: string,
  command: string,
  args: Record<string, unknown> = {}
): DomainOp {
  return { kind: 'domain', clientId, command, args };
}
