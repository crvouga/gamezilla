import { describe, expect, test } from 'bun:test';
import type { HarnessSlice } from '@libs/harness/slices';
import {
  composeHarnessSlices,
  PLATFORM_HARNESS_SLICES,
} from '@libs/harness/slices';
import type { SubClient } from '@libs/sub-client/client';
import type { SubServer } from '@libs/sub-shared/server';

function client(name: string): SubClient {
  return { name, routes: [] };
}

function server(name: string): SubServer {
  return { name } as unknown as SubServer;
}

const PROFILE: HarnessSlice = { name: 'profile', client: client('profile') };
const NOTIFICATIONS: HarnessSlice = {
  name: 'notifications',
  client: client('notifications'),
  server: () => server('notifications'),
};
const FRIENDS: HarnessSlice = {
  name: 'friends',
  client: client('friends'),
  server: () => server('friends'),
};

async function unexpectedRoomService(): Promise<never> {
  throw new Error('slice composition must not call room services');
}

const rooms = {
  read: unexpectedRoomService,
  send: unexpectedRoomService,
  disconnect: unexpectedRoomService,
  eraseIdentity: unexpectedRoomService,
};

describe('composeHarnessSlices', () => {
  test('folds in production order, whatever order the suite lists', () => {
    const composition = composeHarnessSlices('probe', [
      NOTIFICATIONS,
      FRIENDS,
      PROFILE,
    ]);
    // Friends mounts above the inbox it registers a source into. Nothing in
    // this composition owns `/`, so the harness's bare home mounts first.
    expect(composition.clients.map((c) => c.name)).toEqual([
      'harness-home',
      'profile',
      'friends',
      'notifications',
    ]);
    expect(
      composition.servers({ billing: null, rooms }).map((s) => s.name as string)
    ).toEqual(['friends', 'notifications']);
  });

  test('always includes the platform subs', () => {
    const composition = composeHarnessSlices('probe', []);
    expect([...composition.app.subNames].sort()).toEqual(
      PLATFORM_HARNESS_SLICES.map((s) => s.sub?.name ?? '').sort()
    );
  });

  test('rejects a slice listed twice', () => {
    expect(() => composeHarnessSlices('probe', [FRIENDS, FRIENDS])).toThrow(
      /duplicate slice 'friends'/
    );
  });

  test('a composition without rooms declares no room node', () => {
    const composition = composeHarnessSlices('probe', [PROFILE]);
    expect(composition.roomNode).toBeUndefined();
  });
});
