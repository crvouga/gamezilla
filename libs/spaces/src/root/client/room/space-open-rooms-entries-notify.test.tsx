/**
 * Regression: open-rooms registry commit must notify React consumers.
 * A stable dispatch API + ref-only getEntry caused Context bailout so
 * SpaceRoomProvider kept rooms=null → permanent Connecting… / dead Chess.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { asKeyword } from '@pkgs/keyword';
import type { RoomCommandPayload } from '@pkgs/room';
import { act, createElement, type ReactNode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  type SpaceOpenRoomEntry,
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomEntry,
  useSpaceOpenRooms,
  useSpaceOpenRoomsRegistry,
} from '../../../public/room/space-open-rooms-store';

function stubEntry(clientId: string): SpaceOpenRoomEntry {
  return {
    clientId,
    room: {
      dispatch: () => undefined,
      getSnapshot: () => ({}),
      destroy: () => undefined,
    } as unknown as SpaceOpenRoomEntry['room'],
  };
}

function EntryProbe({
  spaceId,
  onEntry,
}: {
  readonly spaceId: string;
  readonly onEntry: (entry: SpaceOpenRoomEntry | null) => void;
}): ReactNode {
  const entry = useSpaceOpenRoomEntry(spaceId);
  useEffect(() => {
    onEntry(entry);
  }, [entry, onEntry]);
  return null;
}

function CommitButton({
  spaceId,
  entry,
}: {
  readonly spaceId: string;
  readonly entry: SpaceOpenRoomEntry;
}): ReactNode {
  const setEntry = useSpaceOpenRoomsRegistry();
  return createElement('button', {
    'data-testid': 'commit',
    type: 'button',
    onClick: () => setEntry(spaceId, entry),
  });
}

function DispatchProbe({ spaceId }: { readonly spaceId: string }): ReactNode {
  const { dispatch } = useSpaceOpenRooms();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return null;
  return createElement('button', {
    'data-testid': 'dispatch',
    type: 'button',
    onClick: () => {
      const payload: RoomCommandPayload = {
        type: asKeyword('team-cmd/select-game'),
        payload: { game: 'chess' },
      };
      dispatch(spaceId, payload);
    },
  });
}

function mount(node: ReactNode): Root {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  act(() => {
    root.render(node);
  });
  return root;
}

function clickTestId(testId: string): void {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`missing [data-testid="${testId}"]`);
  }
  act(() => {
    el.click();
  });
}

describe('SpaceOpenRoomsStoreProvider entries notify', () => {
  beforeAll(() => {
    GlobalRegistrator.register();
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterAll(() => {
    GlobalRegistrator.unregister();
  });

  it('re-renders useSpaceOpenRoomEntry after registry commit', () => {
    const seen: Array<SpaceOpenRoomEntry | null> = [];
    const entry = stubEntry('client-1');

    const root = mount(
      createElement(
        SpaceOpenRoomsStoreProvider,
        null,
        createElement(EntryProbe, {
          spaceId: 'space-1',
          onEntry: (e) => {
            seen.push(e);
          },
        }),
        createElement(CommitButton, { spaceId: 'space-1', entry })
      )
    );

    expect(seen.at(-1)).toBeNull();

    clickTestId('commit');

    expect(seen.at(-1)).toBe(entry);
    expect(seen.at(-1)?.clientId).toBe('client-1');

    act(() => {
      root.unmount();
    });
  });

  it('buffers dispatch until commit then flushes to the room', () => {
    const dispatched: RoomCommandPayload[] = [];
    let roomDispatchCount = 0;
    const entry = stubEntry('client-2');
    (entry.room as { dispatch: (p: RoomCommandPayload) => void }).dispatch = (
      p
    ) => {
      roomDispatchCount += 1;
      dispatched.push(p);
    };

    const root = mount(
      createElement(
        SpaceOpenRoomsStoreProvider,
        null,
        createElement(DispatchProbe, { spaceId: 'space-2' }),
        createElement(CommitButton, { spaceId: 'space-2', entry })
      )
    );

    clickTestId('dispatch');
    expect(roomDispatchCount).toBe(0);

    clickTestId('commit');
    expect(roomDispatchCount).toBe(1);
    expect(dispatched[0]?.payload).toEqual({ game: 'chess' });

    act(() => {
      root.unmount();
    });
  });
});
