import { describe, expect, test } from 'bun:test';
import type { FeatureClient } from '@libs/feature/public/client';
import type { FeatureServer } from '@libs/feature/public/server';
import {
  composeHarnessSlices,
  type HarnessSlice,
  PLATFORM_HARNESS_SLICES,
} from '@libs/harness/slices';

function client(name: string): FeatureClient {
  return { name, routes: [] };
}

function server(name: string): FeatureServer {
  return { name } as unknown as FeatureServer;
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
      composition.servers({ billing: null }).map((s) => s.name as string)
    ).toEqual(['friends', 'notifications']);
  });

  test('always includes the platform features', () => {
    const composition = composeHarnessSlices('probe', []);
    expect([...composition.app.featureNames].sort()).toEqual(
      PLATFORM_HARNESS_SLICES.map((s) => s.feature?.name ?? '').sort()
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
