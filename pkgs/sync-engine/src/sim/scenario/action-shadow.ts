import type { DomainOp, LibraryAction, ServerOp, SyncAction } from './actions';
import type { SyncApp } from './app';

/** Lightweight action eligibility shadow — updated on each apply, not a reference model. */
export type ActionShadow = {
  readonly clientIds: readonly string[];
  online: Set<string>;
  sessionConnected: Set<string>;
  partitioned: Set<string>;
  held: Set<string>;
  crashed: Set<string>;
  authRevoked: Set<string>;
  addedPeerEngines: Set<string>;
  subscribed: number;
  mutations: number;
  domain: unknown;
};

export function createActionShadow(
  app: SyncApp,
  clientIds: readonly string[]
): ActionShadow {
  return {
    clientIds,
    online: new Set(clientIds),
    sessionConnected: new Set(clientIds),
    partitioned: new Set(),
    held: new Set(),
    crashed: new Set(),
    authRevoked: new Set(),
    addedPeerEngines: new Set(),
    subscribed: 0,
    mutations: 0,
    domain: app.domainModel?.initial() ?? null,
  };
}

export function clientLive(shadow: ActionShadow, clientId: string): boolean {
  return (
    shadow.online.has(clientId) &&
    shadow.sessionConnected.has(clientId) &&
    !shadow.crashed.has(clientId) &&
    !shadow.authRevoked.has(clientId)
  );
}

function applyLibraryToShadow(
  shadow: ActionShadow,
  action: LibraryAction
): void {
  switch (action.kind) {
    case 'offline':
      shadow.online.delete(action.clientId);
      break;
    case 'online':
      shadow.online.add(action.clientId);
      break;
    case 'disconnect':
      shadow.sessionConnected.delete(action.clientId);
      break;
    case 'connect':
      shadow.sessionConnected.add(action.clientId);
      break;
    case 'background':
    case 'foreground':
      break;
    case 'partition':
      shadow.partitioned.add(`${action.nodeId}:${action.traffic}`);
      break;
    case 'heal':
      shadow.partitioned.clear();
      shadow.held.clear();
      shadow.subscribed = 0;
      break;
    case 'hold':
      shadow.held.add(`${action.nodeId}:${action.traffic}`);
      break;
    case 'release':
      shadow.held.delete(`${action.nodeId}:${action.traffic}`);
      break;
    case 'crash':
      shadow.crashed.add(action.clientId);
      shadow.sessionConnected.delete(action.clientId);
      break;
    case 'restart':
      shadow.crashed.delete(action.clientId);
      shadow.authRevoked.delete(action.clientId);
      shadow.sessionConnected.add(action.clientId);
      shadow.online.add(action.clientId);
      break;
    case 'restartWithSchema':
      shadow.crashed.delete(action.clientId);
      shadow.authRevoked.delete(action.clientId);
      shadow.sessionConnected.add(action.clientId);
      shadow.online.add(action.clientId);
      break;
    case 'protocolCut':
      break;
    case 'auth':
      if (action.status === 'revoked') {
        shadow.authRevoked.add(action.clientId);
        shadow.sessionConnected.delete(action.clientId);
      } else if (action.status === 'valid') {
        shadow.authRevoked.delete(action.clientId);
        shadow.sessionConnected.add(action.clientId);
      }
      break;
    case 'subscribe':
      shadow.subscribed += 1;
      break;
    case 'clearLocalData':
      break;
    case 'addPeerEngine':
      shadow.addedPeerEngines.add(action.clientId);
      shadow.online.add(action.clientId);
      shadow.sessionConnected.add(action.clientId);
      break;
    default:
      break;
  }
}

export function applyActionToShadow(
  app: SyncApp,
  shadow: ActionShadow,
  action: SyncAction
): void {
  if (action.kind === 'domain' || action.kind === 'server') {
    shadow.mutations += 1;
    app.domainModel?.apply(shadow.domain, action);
    return;
  }
  applyLibraryToShadow(shadow, action);
  if (action.kind === 'heal') {
    app.domainModel?.onHeal?.(shadow.domain);
  }
}

function allowsConnectivity(
  shadow: ActionShadow,
  action: LibraryAction
): boolean | null {
  switch (action.kind) {
    case 'offline':
      return (
        shadow.online.has(action.clientId) &&
        !shadow.crashed.has(action.clientId)
      );
    case 'online':
      return (
        !shadow.online.has(action.clientId) &&
        !shadow.crashed.has(action.clientId)
      );
    case 'disconnect':
      return (
        shadow.sessionConnected.has(action.clientId) &&
        !shadow.crashed.has(action.clientId)
      );
    case 'connect':
      return (
        !shadow.sessionConnected.has(action.clientId) &&
        !shadow.crashed.has(action.clientId)
      );
    case 'background':
    case 'foreground':
      return !shadow.crashed.has(action.clientId);
    default:
      return null;
  }
}

function libraryAllowsAction(
  shadow: ActionShadow,
  action: LibraryAction
): boolean {
  const connectivity = allowsConnectivity(shadow, action);
  if (connectivity !== null) return connectivity;
  switch (action.kind) {
    case 'armHttpFault':
    case 'armCrashAt':
    case 'subscribe':
    case 'clearLocalData':
    case 'tamperLocalStorage':
    case 'protocolCut':
    case 'freeze':
    case 'armStoragePressure':
    case 'failNextOpen':
      return clientLive(shadow, action.clientId);
    case 'partition':
      return !shadow.partitioned.has(`${action.nodeId}:${action.traffic}`);
    case 'heal':
      return shadow.partitioned.size > 0 || shadow.held.size > 0;
    case 'hold':
      return !shadow.held.has(`${action.nodeId}:${action.traffic}`);
    case 'release':
      return shadow.held.has(`${action.nodeId}:${action.traffic}`);
    case 'crash':
    case 'restartWithSchema':
      return !shadow.crashed.has(action.clientId);
    case 'restart':
      return (
        shadow.crashed.has(action.clientId) ||
        shadow.authRevoked.has(action.clientId)
      );
    case 'thaw':
      return !shadow.crashed.has(action.clientId);
    case 'addPeerEngine':
      return (
        clientLive(shadow, action.shareWithClientId) &&
        !shadow.addedPeerEngines.has(action.clientId)
      );
    default:
      return true;
  }
}

export function shadowAllowsAction(
  app: SyncApp,
  shadow: ActionShadow,
  action: SyncAction
): boolean {
  if (action.kind === 'domain') {
    if (!clientLive(shadow, action.clientId)) return false;
    if (app.domainModel?.clientAllows !== undefined) {
      return app.domainModel.clientAllows(
        shadow.domain,
        action,
        clientLive(shadow, action.clientId)
      );
    }
    return app.domainModel?.allows(shadow.domain, action) ?? true;
  }
  if (action.kind === 'server') {
    return app.domainModel?.allows(shadow.domain, action) ?? true;
  }
  return libraryAllowsAction(shadow, action);
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
