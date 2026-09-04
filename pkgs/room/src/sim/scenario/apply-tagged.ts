import type { Script } from '@pkgs/dst';
import { RELIABLE_ROOM_FAULTS } from '../network';
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
  release,
  restart,
  serverCrash,
  serverRestart,
  setNet,
  takeOver,
} from './room-actions';
import type { RoomSurface } from './surface';

/**
 * Map a tagged {@link RoomSystemAction} onto `s.apply` / `s.elapse`.
 * Fuzz harness only — prefer direct `s.apply` in scripted tests.
 */
export async function applyTaggedRoomAction(
  s: Script<RoomSurface>,
  action: RoomSystemAction
): Promise<void> {
  switch (action.kind) {
    case 'domain':
      return s.apply(domain, action);
    case 'disconnect':
      return s.apply(disconnect, action.clientId);
    case 'connect':
      return s.apply(connect, action.clientId);
    case 'hold':
      return s.apply(hold, action.clientId);
    case 'release':
      return s.apply(release, action.clientId);
    case 'down':
      return s.apply(down, action.clientId);
    case 'heal':
      return s.apply(heal);
    case 'idle':
      return s.elapse(action.ms);
    case 'takeOver':
      return s.apply(takeOver, action.clientId);
    case 'crash':
      return s.apply(crash, action.clientId);
    case 'restart':
      return s.apply(restart, action.clientId);
    case 'serverCrash':
      return s.apply(serverCrash);
    case 'serverRestart':
      return s.apply(serverRestart);
    case 'clearLocalData':
      return s.apply(clearLocalData, action.clientId);
    case 'setFaults':
      return s.apply(setNet, {
        clientId: action.clientId,
        next: { ...RELIABLE_ROOM_FAULTS, ...action.faults },
      });
    case 'asymmetricLink':
      return s.apply(setNet, {
        clientId: action.clientId,
        next: action.link,
      });
    case 'armCrashAt':
      return s.apply(armCrashAt, {
        clientId: action.clientId,
        event: action.event,
      });
    case 'injectToServer':
      return s.apply(injectToServer, {
        clientId: action.clientId,
        raw: action.raw,
        ...(action.direct === true ? { direct: true as const } : {}),
      });
    case 'injectFromServer':
      return s.apply(injectFromServer, {
        clientId: action.clientId,
        raw: action.raw,
      });
    case 'addSpectator':
      return s.apply(addSpectator);
    case 'setLink':
      return s.apply(setNet, {
        clientId: action.clientId,
        next: action.link,
      });
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

/** Apply a scripted sequence of tagged room actions on an open run. */
export async function applyTaggedSequence(
  s: Script<RoomSurface>,
  actions: readonly RoomSystemAction[]
): Promise<void> {
  for (const action of actions) {
    await applyTaggedRoomAction(s, action);
  }
}
