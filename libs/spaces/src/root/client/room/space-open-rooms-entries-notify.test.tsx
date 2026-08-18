/**
 * Regression: open-rooms registry commit must notify React consumers.
 * A stable dispatch API + ref-only getEntry caused Context bailout so
 * SpaceRoomProvider kept rooms=null → permanent Connecting… / dead Chess.
 *
 * Uses react-test-renderer (not react-dom / happy-dom) so bun test stays RN-free.
 */
import { describe, expect, it } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import type { RoomCommandPayload } from '@pkgs/room';
import { act, createElement, type ReactNode, useEffect, useState } from 'react';
import TestRenderer from 'react-test-renderer';

import {
  type SpaceOpenRoomEntry,
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomEntry,
  useSpaceOpenRooms,
  useSpaceOpenRoomsRegistry,
} from './space-open-rooms-store';

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
    testID: 'commit',
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
    testID: 'dispatch',
    onClick: () => {
      const payload: RoomCommandPayload = {
        type: asKeyword('team-cmd/select-game'),
        payload: { game: 'chess' },
      };
      dispatch(spaceId, payload);
    },
  });
}

describe('SpaceOpenRoomsStoreProvider entries notify', () => {
  it('re-renders useSpaceOpenRoomEntry after registry commit', () => {
    const seen: Array<SpaceOpenRoomEntry | null> = [];
    const entry = stubEntry('client-1');

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
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
    });

    expect(seen.at(-1)).toBeNull();

    const button = renderer.root.findByProps({ testID: 'commit' });
    act(() => {
      (button.props as { onClick: () => void }).onClick();
    });

    expect(seen.at(-1)).toBe(entry);
    expect(seen.at(-1)?.clientId).toBe('client-1');

    act(() => {
      renderer.unmount();
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

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        createElement(
          SpaceOpenRoomsStoreProvider,
          null,
          createElement(DispatchProbe, { spaceId: 'space-2' }),
          createElement(CommitButton, { spaceId: 'space-2', entry })
        )
      );
    });

    const dispatchBtn = renderer.root.findByProps({ testID: 'dispatch' });
    act(() => {
      (dispatchBtn.props as { onClick: () => void }).onClick();
    });
    expect(roomDispatchCount).toBe(0);

    const commitBtn = renderer.root.findByProps({ testID: 'commit' });
    act(() => {
      (commitBtn.props as { onClick: () => void }).onClick();
    });
    expect(roomDispatchCount).toBe(1);
    expect(dispatched[0]?.payload).toEqual({ game: 'chess' });

    act(() => {
      renderer.unmount();
    });
  });
});
