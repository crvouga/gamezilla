/** @jsxImportSource solid-js */
import {
  asKeyword,
  type LogEntry,
  type RoomActor,
  type RoomState,
} from '@pkgs/room';
import {
  type AnyRoomClient,
  createRoomDispatch,
  createRoomLog,
  createRoomRoster,
  createRoomSelector,
  createRoomSnapshot,
  EMPTY_ROOM_STATE,
  RoomClientsProvider,
  useNamedRoomRoster,
  useRoomDispatch,
  useRoomSelector,
} from '@pkgs/room/solid';
import { render, screen } from '@solidjs/testing-library';
import { createRoot, createSignal } from 'solid-js';
import { describe, expect, test } from 'vitest';

const COUNT = asKeyword('room/count');
const TITLE = asKeyword('room/title');
const PING = { type: asKeyword('cmd/ping'), payload: null };
const HELLO = { type: asKeyword('cmd/hello'), payload: null };

type FakeRoom = AnyRoomClient & {
  setState: (next: RoomState) => void;
  setRoster: (next: readonly RoomActor[]) => void;
  dispatched: unknown[];
  listeners: () => number;
};

function createFakeRoom(initial: RoomState): FakeRoom {
  let state = initial;
  let roster: readonly RoomActor[] = [];
  const log: LogEntry[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const room: FakeRoom = {
    dispatched: [],
    getSnapshot: () => state,
    getLog: () => log,
    getRoster: () => roster,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (payload) => {
      room.dispatched.push(payload);
    },
    setState: (next) => {
      state = next;
      notify();
    },
    setRoster: (next) => {
      roster = next;
      notify();
    },
    listeners: () => listeners.size,
  };
  return room;
}

describe('createRoomSnapshot', () => {
  test('reads synchronously, tracks notify, and swaps rooms', () => {
    createRoot((dispose) => {
      const a = createFakeRoom({ [COUNT]: 1 });
      const b = createFakeRoom({ [COUNT]: 10 });
      const [room, setRoom] = createSignal<FakeRoom | null>(a);
      const snapshot = createRoomSnapshot(room);
      const count = createRoomSelector(room, (s) => Number(s[COUNT]));

      expect(snapshot()).toEqual({ [COUNT]: 1 });
      a.setState({ [COUNT]: 2 });
      expect(count()).toBe(2);
      // one subscription per read primitive (snapshot + selector)
      expect(a.listeners()).toBe(2);

      setRoom(b);
      expect(snapshot()).toEqual({ [COUNT]: 10 });
      expect(a.listeners()).toBe(0);
      a.setState({ [COUNT]: 3 });
      expect(count()).toBe(10);

      setRoom(null);
      expect(snapshot()).toBe(EMPTY_ROOM_STATE);
      expect(b.listeners()).toBe(0);
      dispose();
    });
  });

  test('log, roster, and dispatch follow the room accessor', () => {
    createRoot((dispose) => {
      const a = createFakeRoom({});
      const [room, setRoom] = createSignal<FakeRoom | null>(null);
      const roster = createRoomRoster(room);
      const log = createRoomLog(room);
      const dispatch = createRoomDispatch(room);

      expect(roster()).toEqual([]);
      expect(log()).toEqual([]);
      dispatch(PING);
      expect(a.dispatched).toEqual([]);

      setRoom(a);
      const actor = { clientId: 'c1' } as unknown as RoomActor;
      a.setRoster([actor]);
      expect(roster()).toEqual([actor]);
      dispatch(PING);
      expect(a.dispatched).toEqual([PING]);
      dispose();
    });
  });
});

describe('RoomClientsProvider', () => {
  test('named selectors re-target when the registry changes', () => {
    const lobby = createFakeRoom({ [TITLE]: 'Lobby' });
    const game = createFakeRoom({ [TITLE]: 'Game' });
    const [rooms, setRooms] = createSignal<ReadonlyMap<
      string,
      AnyRoomClient
    > | null>(new Map([['main', lobby]]));

    function Title() {
      const title = useRoomSelector('main', (s) => {
        const value = s[TITLE];
        return typeof value === 'string' ? value : 'none';
      });
      const roster = useNamedRoomRoster('main');
      const dispatch = useRoomDispatch('main');
      return (
        <button type="button" onClick={() => dispatch(HELLO)}>
          {title()} ({roster().length})
        </button>
      );
    }

    render(() => (
      <RoomClientsProvider rooms={rooms()}>
        <Title />
      </RoomClientsProvider>
    ));

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Lobby (0)');
    lobby.setState({ [TITLE]: 'Lobby 2' });
    expect(button).toHaveTextContent('Lobby 2 (0)');

    button.click();
    expect(lobby.dispatched).toEqual([HELLO]);

    setRooms(new Map([['main', game]]));
    expect(button).toHaveTextContent('Game (0)');
    expect(lobby.listeners()).toBe(0);

    setRooms(null);
    expect(button).toHaveTextContent('none (0)');
    button.click();
    expect(game.dispatched).toEqual([]);
  });
});
