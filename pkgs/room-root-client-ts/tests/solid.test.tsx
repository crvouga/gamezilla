/** @jsxImportSource @solidjs/web */

import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import type { AnyRoomClient } from '@pkgs/room-root-client-ts/room-clients-context';
import {
  RoomClientsProvider,
  useNamedRoomRoster,
  useRoomDispatch,
  useRoomSelector,
} from '@pkgs/room-root-client-ts/room-clients-context';
import {
  createRoomDispatch,
  createRoomLog,
  createRoomRoster,
  createRoomSelector,
  createRoomSnapshot,
  EMPTY_ROOM_STATE,
} from '@pkgs/room-root-client-ts/room-signals';
import type {
  LogEntry,
  RoomActor,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { render, screen } from '@solidjs/testing-library';
import { createEffect, createRoot, createSignal, flush } from 'solid-js';

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
      return `fake-command-${room.dispatched.length}`;
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
  // regression: puzzle-room-selector-fanout
  test('one room update publishes all selectors together', () => {
    const source = createFakeRoom({ [COUNT]: 1, [TITLE]: 'First' });
    const seen: string[] = [];
    const dispose = createRoot((cleanup) => {
      const count = createRoomSelector(
        () => source,
        (s) => Number(s[COUNT])
      );
      const title = createRoomSelector(
        () => source,
        (s) => String(s[TITLE])
      );
      createEffect(
        () => `${count()}:${title()}`,
        (value) => {
          seen.push(value);
        }
      );
      return cleanup;
    });
    flush();
    try {
      source.setState({ [COUNT]: 2, [TITLE]: 'Second' });
      flush();
      expect(seen).toEqual(['1:First', '2:Second']);
      expect(source.listeners()).toBe(1);
    } finally {
      dispose();
    }
    expect(source.listeners()).toBe(0);
  });
  test('reads synchronously, tracks notify, and swaps rooms', () => {
    const a = createFakeRoom({ [COUNT]: 1 });
    const b = createFakeRoom({ [COUNT]: 10 });
    const [room, setRoom] = createSignal<FakeRoom | null>(a);
    const { snapshot, count, dispose } = createRoot((cleanup) => ({
      snapshot: createRoomSnapshot(room),
      count: createRoomSelector(room, (s) => Number(s[COUNT])),
      dispose: cleanup,
    }));

    expect(snapshot()).toEqual({ [COUNT]: 1 });
    a.setState({ [COUNT]: 2 });
    flush();
    expect(count()).toBe(2);
    // All read primitives share one subscription and one batched update.
    expect(a.listeners()).toBe(1);

    setRoom(b);
    flush();
    expect(snapshot()).toEqual({ [COUNT]: 10 });
    expect(a.listeners()).toBe(0);
    a.setState({ [COUNT]: 3 });
    flush();
    expect(count()).toBe(10);

    setRoom(null);
    flush();
    expect(snapshot()).toBe(EMPTY_ROOM_STATE);
    expect(b.listeners()).toBe(0);
    dispose();
  });

  test('log, roster, and dispatch follow the room accessor', () => {
    const a = createFakeRoom({});
    const [room, setRoom] = createSignal<FakeRoom | null>(null);
    const { roster, log, dispatch, dispose } = createRoot((cleanup) => ({
      roster: createRoomRoster(room),
      log: createRoomLog(room),
      dispatch: createRoomDispatch(room),
      dispose: cleanup,
    }));

    expect(roster()).toEqual([]);
    expect(log()).toEqual([]);
    dispatch(PING);
    expect(a.dispatched).toEqual([]);

    setRoom(a);
    flush();
    const actor = { clientId: 'c1' } as unknown as RoomActor;
    a.setRoster([actor]);
    flush();
    expect(roster()).toEqual([actor]);
    dispatch(PING);
    expect(a.dispatched).toEqual([PING]);
    dispose();
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
    flush();
    expect(button).toHaveTextContent('Lobby 2 (0)');

    button.click();
    expect(lobby.dispatched).toEqual([HELLO]);

    setRooms(new Map([['main', game]]));
    flush();
    expect(button).toHaveTextContent('Game (0)');
    expect(lobby.listeners()).toBe(0);

    setRooms(null);
    flush();
    expect(button).toHaveTextContent('none (0)');
    button.click();
    expect(game.dispatched).toEqual([]);
  });
});
