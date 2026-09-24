import { describe, expect, test } from 'bun:test';
import type { FeatureClient } from '@libs/feature/public/client';
import type { FeatureServer } from '@libs/feature/public/server';
import {
  composeSimSlices,
  PLATFORM_SIM_SLICES,
  type SimSlice,
} from '@libs/sim-harness/slices';

function client(name: string): FeatureClient {
  return { name, routes: [] };
}

function server(name: string): FeatureServer {
  return { name } as unknown as FeatureServer;
}

const PROFILE: SimSlice = { name: 'profile', client: client('profile') };
const NOTIFICATIONS: SimSlice = {
  name: 'notifications',
  client: client('notifications'),
  server: () => server('notifications'),
};
const FRIENDS: SimSlice = {
  name: 'friends',
  client: client('friends'),
  server: () => server('friends'),
};

describe('composeSimSlices', () => {
  test('folds in production order, whatever order the suite lists', () => {
    const composition = composeSimSlices('probe', [
      NOTIFICATIONS,
      FRIENDS,
      PROFILE,
    ]);
    // Friends mounts above the inbox it registers a source into. Nothing in
    // this composition owns `/`, so the harness's bare home mounts first.
    expect(composition.clients.map((c) => c.name)).toEqual([
      'sim-home',
      'profile',
      'friends',
      'notifications',
    ]);
    expect(
      composition.servers({ billing: null }).map((s) => s.name as string)
    ).toEqual(['friends', 'notifications']);
  });

  test('always includes the platform features', () => {
    const composition = composeSimSlices('probe', []);
    expect([...composition.app.featureNames].sort()).toEqual(
      PLATFORM_SIM_SLICES.map((s) => s.feature?.name ?? '').sort()
    );
  });

  test('rejects a slice listed twice', () => {
    expect(() => composeSimSlices('probe', [FRIENDS, FRIENDS])).toThrow(
      /duplicate slice 'friends'/
    );
  });

  test('a composition without rooms declares no room node', () => {
    const composition = composeSimSlices('probe', [PROFILE]);
    expect(composition.roomNode).toBeUndefined();
  });
});
