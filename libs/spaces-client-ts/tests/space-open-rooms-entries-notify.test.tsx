/**
 * Regression: open-rooms registry commit must notify Solid consumers.
 * A stable dispatch API alone caused detail UI to keep rooms=null →
 * permanent Connecting… / dead Chess.
 */

import { describe, expect, it } from 'bun:test';
import type { SpaceOpenRoomEntry } from '@libs/spaces-client-ts/space-open-rooms-store';
import {
  SpaceOpenRoomsStoreProvider,
  useSpaceOpenRoomEntry,
  useSpaceOpenRooms,
  useSpaceOpenRoomsRegistry,
} from '@libs/spaces-client-ts/space-open-rooms-store';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import type { RoomCommandPayload } from '@pkgs/room-root-shared-ts/types';
import { render, screen } from '@solidjs/testing-library';
import { createEffect, type JSX } from 'solid-js';

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

function EntryProbe(props: {
  readonly spaceId: string;
  readonly onEntry: (entry: SpaceOpenRoomEntry | null) => void;
}): JSX.Element {
  const entry = useSpaceOpenRoomEntry(props.spaceId);
  createEffect(() => {
    props.onEntry(entry());
  });
  return null;
}

function CommitButton(props: {
  readonly spaceId: string;
  readonly entry: SpaceOpenRoomEntry;
}): JSX.Element {
  const setEntry = useSpaceOpenRoomsRegistry();
  return (
    <button
      data-testid="commit"
      type="button"
      onClick={() => setEntry(props.spaceId, props.entry)}
    >
      commit
    </button>
  );
}

function DispatchProbe(props: { readonly spaceId: string }): JSX.Element {
  const { dispatch } = useSpaceOpenRooms();
  return (
    <button
      data-testid="dispatch"
      type="button"
      onClick={() => {
        const payload: RoomCommandPayload = {
          type: asKeyword('team-cmd/select-game'),
          payload: { game: 'race' },
        };
        dispatch(props.spaceId, payload);
      }}
    >
      dispatch
    </button>
  );
}

function mount(node: () => JSX.Element): () => void {
  const view = render(node);
  return () => view.unmount();
}

/** Solid commits synchronously; drain the microtasks its effects queue. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('SpaceOpenRoomsStoreProvider entries notify', () => {
  it('re-renders useSpaceOpenRoomEntry after registry commit', async () => {
    const seen: Array<SpaceOpenRoomEntry | null> = [];
    const entry = stubEntry('client-1');

    const unmount = mount(() => (
      <SpaceOpenRoomsStoreProvider>
        <EntryProbe
          spaceId="space-1"
          onEntry={(e) => {
            seen.push(e);
          }}
        />
        <CommitButton spaceId="space-1" entry={entry} />
      </SpaceOpenRoomsStoreProvider>
    ));
    await flush();

    expect(seen.at(-1)).toBeNull();

    screen.getByTestId('commit').click();
    await flush();

    expect(seen.at(-1)).toBe(entry);
    expect(seen.at(-1)?.clientId).toBe('client-1');

    unmount();
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

    const unmount = mount(() => (
      <SpaceOpenRoomsStoreProvider>
        <DispatchProbe spaceId="space-2" />
        <CommitButton spaceId="space-2" entry={entry} />
      </SpaceOpenRoomsStoreProvider>
    ));

    screen.getByTestId('dispatch').click();
    expect(roomDispatchCount).toBe(0);

    screen.getByTestId('commit').click();
    expect(roomDispatchCount).toBe(1);
    expect(dispatched[0]?.payload).toEqual({ game: 'race' });

    unmount();
  });
});
