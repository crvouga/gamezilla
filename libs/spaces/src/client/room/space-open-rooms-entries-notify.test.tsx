/**
 * Regression: open-rooms registry commit must notify React consumers.
 * A stable dispatch API + ref-only getEntry caused Context bailout so
 * SpaceRoomProvider kept rooms=null → permanent Connecting… / dead Chess.
 */
import { beforeAll, describe, expect, it } from 'bun:test';
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
} from './space-open-rooms-store';

beforeAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator');
  GlobalRegistrator.register();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

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
    type: 'button',
    'data-testid': 'commit',
    onClick: () => setEntry(spaceId, entry),
  });
}

function DispatchProbe({
  spaceId,
  onDispatched,
}: {
  readonly spaceId: string;
  readonly onDispatched: (payload: RoomCommandPayload) => void;
}): ReactNode {
  const { dispatch } = useSpaceOpenRooms();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return null;
  return createElement('button', {
    type: 'button',
    'data-testid': 'dispatch',
    onClick: () => {
      const payload: RoomCommandPayload = {
        type: asKeyword('games-cmd/select-game'),
        payload: { game: 'chess' },
      };
      dispatch(spaceId, payload);
      onDispatched(payload);
    },
  });
}

describe('SpaceOpenRoomsStoreProvider entries notify', () => {
  it('re-renders useSpaceOpenRoomEntry after registry commit', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const seen: Array<SpaceOpenRoomEntry | null> = [];
    const entry = stubEntry('client-1');

    await act(async () => {
      root.render(
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

    const button = container.querySelector(
      '[data-testid="commit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect(seen.at(-1)).toBe(entry);
    expect(seen.at(-1)?.clientId).toBe('client-1');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('buffers dispatch until commit then flushes to the room', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const dispatched: RoomCommandPayload[] = [];
    let roomDispatchCount = 0;
    const entry = stubEntry('client-2');
    (entry.room as { dispatch: (p: RoomCommandPayload) => void }).dispatch = (
      p
    ) => {
      roomDispatchCount += 1;
      dispatched.push(p);
    };

    await act(async () => {
      root.render(
        createElement(
          SpaceOpenRoomsStoreProvider,
          null,
          createElement(DispatchProbe, {
            spaceId: 'space-2',
            onDispatched: () => undefined,
          }),
          createElement(CommitButton, { spaceId: 'space-2', entry })
        )
      );
    });

    const dispatchBtn = container.querySelector(
      '[data-testid="dispatch"]'
    ) as HTMLButtonElement;
    await act(async () => {
      dispatchBtn.click();
    });
    expect(roomDispatchCount).toBe(0);

    const commitBtn = container.querySelector(
      '[data-testid="commit"]'
    ) as HTMLButtonElement;
    await act(async () => {
      commitBtn.click();
    });
    expect(roomDispatchCount).toBe(1);
    expect(dispatched[0]?.payload).toEqual({ game: 'chess' });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
