/**
 * One-shot boundary crash arms for room DST.
 * Named after observable wire / schedule events — never internal modules.
 */

export type RoomCrashEvent =
  | 'afterNextWelcome'
  | 'afterNextCommitted'
  | 'afterNextCommandAck'
  | 'onNextScheduleWake';

/** Arms that hang random `fc.commands` sequences (need scripted hold). */
export const SIM_PBT_CRASH_EVENTS: readonly RoomCrashEvent[] = [
  'afterNextWelcome',
  'afterNextCommitted',
  'afterNextCommandAck',
] as const;

export const ALL_ROOM_CRASH_EVENTS: readonly RoomCrashEvent[] = [
  ...SIM_PBT_CRASH_EVENTS,
  'onNextScheduleWake',
] as const;

export type RoomEdgeFaultController = {
  readonly armCrash: (nodeId: string, event: RoomCrashEvent) => void;
  readonly clearCrashArms: (nodeId?: string) => void;
  readonly takeCrash: (nodeId: string, event: RoomCrashEvent) => boolean;
  readonly hasAnyArm: () => boolean;
};

/** In-memory one-shot crash arms keyed by client node id (or `server`). */
export function createRoomEdgeFaultController(): RoomEdgeFaultController {
  const crashes = new Map<string, Set<RoomCrashEvent>>();

  return {
    armCrash(nodeId, event) {
      let set = crashes.get(nodeId);
      if (set === undefined) {
        set = new Set();
        crashes.set(nodeId, set);
      }
      set.add(event);
    },
    clearCrashArms(nodeId) {
      if (nodeId === undefined) {
        crashes.clear();
        return;
      }
      crashes.delete(nodeId);
    },
    takeCrash(nodeId, event) {
      const set = crashes.get(nodeId);
      if (set === undefined || !set.has(event)) return false;
      set.delete(event);
      if (set.size === 0) crashes.delete(nodeId);
      return true;
    },
    hasAnyArm() {
      return crashes.size > 0;
    },
  };
}
