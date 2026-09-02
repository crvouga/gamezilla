import type { DomainOp, LibraryAction, RoomSystemAction } from './actions';
import type { RoomApp } from './app';
import { defaultClientIds } from './client-ids';

export type ActionShadow = {
  readonly clientIds: readonly string[];
  sessionConnected: Set<string>;
  held: Set<string>;
  down: Set<string>;
  crashed: Set<string>;
  armedCommitted: Set<string>;
  armedCommandAck: Set<string>;
  serverCrashed: boolean;
  spectatorCount: number;
  mutations: number;
  domain: unknown;
};

export function createActionShadow(
  app: RoomApp,
  clientIds: readonly string[]
): ActionShadow {
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

export function clientLive(shadow: ActionShadow, clientId: string): boolean {
  return (
    shadow.sessionConnected.has(clientId) &&
    !shadow.crashed.has(clientId) &&
    !shadow.serverCrashed
  );
}

function markCrashed(shadow: ActionShadow, clientId: string): void {
  shadow.crashed.add(clientId);
  shadow.sessionConnected.delete(clientId);
  shadow.armedCommitted.delete(clientId);
  shadow.armedCommandAck.delete(clientId);
}

function tripCommittedArms(shadow: ActionShadow, actorId: string): void {
  for (const id of [...shadow.armedCommitted]) {
    if (shadow.down.has(id) || shadow.held.has(id) || shadow.crashed.has(id)) {
      continue;
    }
    markCrashed(shadow, id);
  }
  if (
    shadow.armedCommandAck.has(actorId) &&
    !shadow.down.has(actorId) &&
    !shadow.held.has(actorId)
  ) {
    markCrashed(shadow, actorId);
  }
}

function applyLibraryToShadow(
  shadow: ActionShadow,
  action: LibraryAction
): void {
  switch (action.kind) {
    case 'disconnect':
      shadow.sessionConnected.delete(action.clientId);
      break;
    case 'connect':
      shadow.sessionConnected.add(action.clientId);
      break;
    case 'hold':
      shadow.held.add(action.clientId);
      shadow.down.delete(action.clientId);
      break;
    case 'release':
      shadow.held.delete(action.clientId);
      break;
    case 'down':
      shadow.down.add(action.clientId);
      shadow.held.delete(action.clientId);
      break;
    case 'heal':
      shadow.held.clear();
      shadow.down.clear();
      break;
    case 'crash':
      markCrashed(shadow, action.clientId);
      break;
    case 'restart':
      shadow.crashed.delete(action.clientId);
      shadow.sessionConnected.add(action.clientId);
      break;
    case 'serverCrash':
      shadow.serverCrashed = true;
      break;
    case 'serverRestart':
      shadow.serverCrashed = false;
      break;
    case 'armCrashAt':
      if (action.event === 'afterNextCommitted') {
        shadow.armedCommitted.add(action.clientId);
      } else if (action.event === 'afterNextCommandAck') {
        shadow.armedCommandAck.add(action.clientId);
      }
      break;
    case 'clearLocalData':
      break;
    case 'addSpectator':
      shadow.spectatorCount += 1;
      break;
    case 'setLink':
      if (action.link === 'hold') {
        shadow.held.add(action.clientId);
        shadow.down.delete(action.clientId);
      } else if (action.link === 'down') {
        shadow.down.add(action.clientId);
        shadow.held.delete(action.clientId);
      } else {
        shadow.held.delete(action.clientId);
        shadow.down.delete(action.clientId);
      }
      break;
    default:
      break;
  }
}

export function applyActionToShadow(
  app: RoomApp,
  shadow: ActionShadow,
  action: RoomSystemAction
): void {
  if (action.kind === 'domain') {
    shadow.mutations += 1;
    app.domainModel?.apply(shadow.domain, action);
    tripCommittedArms(shadow, action.clientId);
    return;
  }
  applyLibraryToShadow(shadow, action);
  if (action.kind === 'heal') {
    app.domainModel?.onHeal?.(shadow.domain);
  }
}

function libraryAllowsAction(
  shadow: ActionShadow,
  action: LibraryAction
): boolean {
  switch (action.kind) {
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
    case 'hold':
      return (
        !shadow.held.has(action.clientId) &&
        !shadow.crashed.has(action.clientId)
      );
    case 'release':
      return shadow.held.has(action.clientId);
    case 'down':
      return (
        !shadow.down.has(action.clientId) &&
        !shadow.crashed.has(action.clientId)
      );
    case 'heal':
      return shadow.held.size > 0 || shadow.down.size > 0;
    case 'takeOver':
      return clientLive(shadow, action.clientId);
    case 'crash':
      return !shadow.crashed.has(action.clientId);
    case 'restart':
      return shadow.crashed.has(action.clientId);
    case 'serverCrash':
      return !shadow.serverCrashed;
    case 'serverRestart':
      return shadow.serverCrashed;
    case 'clearLocalData':
      return !shadow.crashed.has(action.clientId);
    case 'armCrashAt':
      return clientLive(shadow, action.clientId);
    case 'injectToServer':
    case 'injectFromServer':
      return !shadow.crashed.has(action.clientId);
    case 'setFaults':
    case 'asymmetricLink':
    case 'setLink':
      return !shadow.crashed.has(action.clientId);
    case 'addSpectator':
      return shadow.spectatorCount < 2;
    case 'idle':
      return true;
    default:
      return true;
  }
}

/** Client ids that can receive a generated library action of `kind`. */
export function validClientIdsForLibrary(
  shadow: ActionShadow,
  kind: LibraryAction['kind']
): readonly string[] {
  const ids = defaultClientIds(shadow.clientIds);
  switch (kind) {
    case 'disconnect':
      return ids.filter(
        (id) => shadow.sessionConnected.has(id) && !shadow.crashed.has(id)
      );
    case 'connect':
      return ids.filter(
        (id) => !shadow.sessionConnected.has(id) && !shadow.crashed.has(id)
      );
    case 'hold':
      return ids.filter(
        (id) => !shadow.held.has(id) && !shadow.crashed.has(id)
      );
    case 'release':
      return ids.filter((id) => shadow.held.has(id));
    case 'down':
      return ids.filter(
        (id) => !shadow.down.has(id) && !shadow.crashed.has(id)
      );
    case 'takeOver':
      return ids.filter((id) => clientLive(shadow, id));
    case 'crash':
      return ids.filter((id) => !shadow.crashed.has(id));
    case 'restart':
      return ids.filter((id) => shadow.crashed.has(id));
    case 'clearLocalData':
    case 'setFaults':
    case 'asymmetricLink':
    case 'setLink':
    case 'injectToServer':
    case 'injectFromServer':
      return ids.filter((id) => !shadow.crashed.has(id));
    case 'armCrashAt':
      return ids.filter((id) => clientLive(shadow, id));
    case 'heal':
    case 'idle':
    case 'serverCrash':
    case 'serverRestart':
    case 'addSpectator':
      return ids;
    default:
      return ids;
  }
}

export function shadowAllowsAction(
  app: RoomApp,
  shadow: ActionShadow,
  action: RoomSystemAction
): boolean {
  if (action.kind === 'domain') {
    if (!clientLive(shadow, action.clientId)) return false;
    if (app.domainModel?.clientAllows !== undefined) {
      return app.domainModel.clientAllows(shadow.domain, action, true);
    }
    return app.domainModel?.allows(shadow.domain, action) ?? true;
  }
  return libraryAllowsAction(shadow, action);
}

export function domainOp(
  clientId: string,
  command: string,
  args: Record<string, unknown> = {}
): DomainOp {
  return { kind: 'domain', clientId, command, args };
}
