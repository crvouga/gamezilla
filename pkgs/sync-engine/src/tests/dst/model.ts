import type { SimCrashEvent, SimHttpFault } from '../../sim/boundary-faults';
import type { SimAuthStatus } from '../../sim/client-factory';
import type { SimTraffic } from '../../sim/traffic';
import type { DstAction, DomainOp, LibraryAction, ServerOp } from './actions';
import type { DstApp } from './app';

export type WorldModel = {
  readonly clientIds: readonly string[];
  online: Set<string>;
  sessionConnected: Set<string>;
  partitioned: Set<string>;
  held: Set<string>;
  crashed: Set<string>;
  authRevoked: Set<string>;
  subscribed: number;
  mutations: number;
  domain: unknown;
};

export type WorldReal = {
  readonly clientIds: readonly string[];
  readonly actions: DstAction[];
};

export const CLIENT_IDS = ['c0', 'c1', 'c2'] as const;

export const CRASH_EVENTS: readonly SimCrashEvent[] = [
  'afterNextSyncResponseDelivered',
  'afterNextMutateResolved',
  'afterNextMutationsPostAccepted',
  'onNextTimerTickWhileSyncUndelivered',
  'onNextEngineOpenAfterCacheWipe',
];

/** Excludes arms that need scripted sync-hold (hang in random sequences). */
export const WORLD_PBT_CRASH_EVENTS: readonly SimCrashEvent[] =
  CRASH_EVENTS.filter((e) => e !== 'afterNextSyncResponseDelivered');

export const HTTP_FAULTS: readonly SimHttpFault[] = [
  { kind: 'dropMutationsResponse' },
  { kind: 'dropQueryResponse' },
  { kind: 'failMutationsAfterCommit' },
  { kind: 'failMutationsInsideTxnAfter', after: 0 },
  { kind: 'invalidMutationsBody' },
  { kind: 'serverErrorOnNext', route: 'mutations' },
  { kind: 'serverErrorOnNext', route: 'query' },
];

export const AUTH_STATUSES: readonly SimAuthStatus[] = [
  'valid',
  'expired',
  'revoked',
];

export const HOLD_TRAFFIC: readonly SimTraffic[] = ['live', 'sync', 'all'];

export function initialWorldModel(
  app: DstApp,
  clientIds: readonly string[]
): WorldModel {
  return {
    clientIds,
    online: new Set(clientIds),
    sessionConnected: new Set(clientIds),
    partitioned: new Set(),
    held: new Set(),
    crashed: new Set(),
    authRevoked: new Set(),
    subscribed: 0,
    mutations: 0,
    domain: app.domainModel?.initial() ?? null,
  };
}

export function clientLive(m: WorldModel, clientId: string): boolean {
  return (
    m.online.has(clientId) &&
    m.sessionConnected.has(clientId) &&
    !m.crashed.has(clientId) &&
    !m.authRevoked.has(clientId)
  );
}

function applyLibraryToModel(m: WorldModel, action: LibraryAction): void {
  switch (action.kind) {
    case 'offline':
      m.online.delete(action.clientId);
      break;
    case 'online':
      m.online.add(action.clientId);
      break;
    case 'disconnect':
      m.sessionConnected.delete(action.clientId);
      break;
    case 'connect':
      m.sessionConnected.add(action.clientId);
      break;
    case 'background':
    case 'foreground':
      break;
    case 'partition':
      m.partitioned.add(`${action.nodeId}:${action.traffic}`);
      break;
    case 'heal':
      m.partitioned.clear();
      m.held.clear();
      m.subscribed = 0;
      break;
    case 'hold':
      m.held.add(`${action.nodeId}:${action.traffic}`);
      break;
    case 'release':
      m.held.delete(`${action.nodeId}:${action.traffic}`);
      break;
    case 'crash':
      m.crashed.add(action.clientId);
      m.sessionConnected.delete(action.clientId);
      break;
    case 'restart':
      m.crashed.delete(action.clientId);
      m.authRevoked.delete(action.clientId);
      m.sessionConnected.add(action.clientId);
      m.online.add(action.clientId);
      break;
    case 'auth':
      if (action.status === 'revoked') {
        m.authRevoked.add(action.clientId);
        m.sessionConnected.delete(action.clientId);
      } else if (action.status === 'valid') {
        m.authRevoked.delete(action.clientId);
        m.sessionConnected.add(action.clientId);
      }
      break;
    case 'subscribe':
      m.subscribed += 1;
      break;
    case 'clearLocalData':
      break;
    default:
      break;
  }
}

export function applyActionToModel(
  app: DstApp,
  m: WorldModel,
  action: DstAction
): void {
  if (action.kind === 'domain' || action.kind === 'server') {
    m.mutations += 1;
    app.domainModel?.apply(m.domain, action);
    return;
  }
  applyLibraryToModel(m, action);
  if (action.kind === 'heal') {
    app.domainModel?.onHeal?.(m.domain);
  }
}

function libraryAllowsAction(m: WorldModel, action: LibraryAction): boolean {
  switch (action.kind) {
    case 'armHttpFault':
    case 'armCrashAt':
    case 'subscribe':
    case 'clearLocalData':
      return clientLive(m, action.clientId);
    case 'offline':
      return m.online.has(action.clientId) && !m.crashed.has(action.clientId);
    case 'online':
      return !m.online.has(action.clientId) && !m.crashed.has(action.clientId);
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
    case 'background':
    case 'foreground':
      return !m.crashed.has(action.clientId);
    case 'partition':
      return !m.partitioned.has(`${action.nodeId}:${action.traffic}`);
    case 'heal':
      return m.partitioned.size > 0 || m.held.size > 0;
    case 'hold':
      return !m.held.has(`${action.nodeId}:${action.traffic}`);
    case 'release':
      return m.held.has(`${action.nodeId}:${action.traffic}`);
    case 'crash':
      return !m.crashed.has(action.clientId);
    case 'restart':
      return (
        m.crashed.has(action.clientId) || m.authRevoked.has(action.clientId)
      );
    case 'publishFault':
    case 'idle':
    case 'skew':
    case 'setFaults':
    case 'auth':
      return true;
    default:
      return true;
  }
}

export function modelAllowsAction(
  app: DstApp,
  m: WorldModel,
  action: DstAction
): boolean {
  if (action.kind === 'domain') {
    if (!clientLive(m, action.clientId)) return false;
    if (app.domainModel?.clientAllows !== undefined) {
      return app.domainModel.clientAllows(
        m.domain,
        action,
        clientLive(m, action.clientId)
      );
    }
    return app.domainModel?.allows(m.domain, action) ?? true;
  }
  if (action.kind === 'server') {
    return app.domainModel?.allows(m.domain, action) ?? true;
  }
  return libraryAllowsAction(m, action);
}

export function domainOp(
  clientId: string,
  mutation: string,
  args: Record<string, unknown>
): DomainOp {
  return { kind: 'domain', clientId, mutation, args };
}

export function serverOp(
  name: string,
  args: Record<string, unknown>
): ServerOp {
  return { kind: 'server', name, args };
}
