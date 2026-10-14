import {
  NoteActivity,
  SpaceActivityAttr,
} from '@libs/spaces-shared/space-activity';
import { isViewingSpaceClient } from '@libs/spaces-shared/space-presence-client-id';
import { useClock, useTimers } from '@pkgs/clock-client/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { useSpaceRoomClientId } from './space-room-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

const NOTE_RETRY_MS = 1_000;

/**
 * Tell the space this device is here. Repeats until the room records a new
 * time, and again when the connection comes back.
 */
export function useNoteSpaceActivity(): () => void {
  const dispatch = useSpaceRoomDispatch();
  const clientId = useSpaceRoomClientId();
  const activity = useSpaceRoomSelector(SpaceActivityAttr.activity.from);
  const connected = useSpaceRoomSelector(RoomMetaAttr.isConnected.from);
  const engine = useSyncEngine();
  const timers = useTimers();
  const clock = useClock();
  const [attempt, setAttempt] = createSignal(0);
  const [epoch, setEpoch] = createSignal(0);
  const sawOffline = { current: false };
  const baseline = { current: undefined as number | undefined };
  const baselinedEpoch = { current: -1 };
  const sent = { current: false };
  const pending = {
    current: undefined as
      | { epoch: number; clientId: string; at: number }
      | undefined,
  };

  const sendPending = (id: string, current: number): void => {
    if (sent.current) return;
    sent.current = true;
    if (pending.current?.epoch !== current || pending.current.clientId !== id)
      pending.current = { epoch: current, clientId: id, at: clock.now() };
    dispatch(NoteActivity({ clientId: id, at: pending.current.at }));
  };

  const note = (): void => {
    const id = clientId();
    if (id === null || !isViewingSpaceClient(id)) return;
    dispatch(NoteActivity({ clientId: id, at: clock.now() }));
  };

  createEffect(() => {
    // Availability of the host never turns this device's quiet time into activity.
    const online = engine.status().online;
    if (!online) {
      sawOffline.current = true;
      return;
    }
    if (!sawOffline.current) return;
    sawOffline.current = false;
    sent.current = false;
    setEpoch((value) => value + 1);
  });

  createEffect(() => {
    attempt();
    const id = clientId();
    const online = engine.status().online && connected();
    if (id === null || !isViewingSpaceClient(id) || !online) return;
    const recorded = activity()[id];
    const current = epoch();
    // A stamp already in the room is this device's last action. Noting
    // again on a remount would wipe idle. A return from offline must note.
    if (current === 0) {
      if (recorded !== undefined) return;
    } else {
      if (baselinedEpoch.current !== current) {
        baselinedEpoch.current = current;
        baseline.current = recorded;
        sent.current = false;
      }
      if (recorded !== undefined && recorded !== baseline.current) return;
    }
    // One note until the retry. A rejection rolls the stamp back; noting
    // again in that same moment never lands.
    sendPending(id, current);
    const handle = timers.setTimeout(() => {
      sent.current = false;
      setAttempt((value) => value + 1);
    }, NOTE_RETRY_MS);
    onCleanup(() => timers.clearTimeout(handle));
  });

  return note;
}
