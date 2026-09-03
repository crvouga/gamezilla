import type { Run } from '@pkgs/dst';
import type { RoomSystemAction } from './actions';
import {
  addSpectator,
  armCrashAt,
  clearLocalData,
  connect,
  crash,
  disconnect,
  domain,
  down,
  heal,
  hold,
  injectFromServer,
  injectToServer,
  passTime,
  release,
  restart,
  serverCrash,
  serverRestart,
  setNet,
  takeOver,
} from './room-actions';
import type { RoomSurface } from './surface';

async function applyLibrary(
  run: Run<RoomSurface>,
  action: Exclude<RoomSystemAction, { kind: 'domain' }>
): Promise<void> {
  switch (action.kind) {
    case 'disconnect':
      return run.apply(disconnect, action.clientId);
    case 'connect':
      return run.apply(connect, action.clientId);
    case 'hold':
      return run.apply(hold, action.clientId);
    case 'release':
      return run.apply(release, action.clientId);
    case 'down':
      return run.apply(down, action.clientId);
    case 'heal':
      return run.apply(heal);
    case 'idle':
      return run.apply(passTime, action.ms);
    case 'takeOver':
      return run.apply(takeOver, action.clientId);
    case 'crash':
      return run.apply(crash, action.clientId);
    case 'restart':
      return run.apply(restart, action.clientId);
    case 'serverCrash':
      return run.apply(serverCrash);
    case 'serverRestart':
      return run.apply(serverRestart);
    case 'clearLocalData':
      return run.apply(clearLocalData, action.clientId);
    case 'setFaults':
      return run.apply(setNet, {
        clientId: action.clientId,
        next: action.faults,
      });
    case 'asymmetricLink':
      return run.apply(setNet, {
        clientId: action.clientId,
        next: action.link,
      });
    case 'armCrashAt':
      return run.apply(armCrashAt, {
        clientId: action.clientId,
        event: action.event,
      });
    case 'injectToServer':
      return run.apply(injectToServer, {
        clientId: action.clientId,
        raw: action.raw,
        direct: action.direct,
      });
    case 'injectFromServer':
      return run.apply(injectFromServer, {
        clientId: action.clientId,
        raw: action.raw,
      });
    case 'addSpectator':
      return run.apply(addSpectator);
    case 'setLink':
      return run.apply(setNet, {
        clientId: action.clientId,
        next: action.link,
      });
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

/** Apply a tagged {@link RoomSystemAction} through `run.apply`. */
export async function applyRoomAction(
  run: Run<RoomSurface>,
  action: RoomSystemAction
): Promise<void> {
  if (action.kind === 'domain') {
    await run.apply(domain, action);
    return;
  }
  await applyLibrary(run, action);
}

export async function playRoomActions(
  run: Run<RoomSurface>,
  actionList: readonly RoomSystemAction[]
): Promise<void> {
  for (const action of actionList) {
    await applyRoomAction(run, action);
  }
}
