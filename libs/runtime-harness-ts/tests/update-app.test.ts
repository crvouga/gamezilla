import { expect, test } from 'bun:test';
import { createHarnessAppBuilds } from '@libs/harness-ts/app-build';
import { updateApp } from '@libs/runtime-harness-ts/app-lifecycle';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** A live browser device left offline by its own Work offline choice. */
async function offlineBrowserDevice() {
  const did: string[] = [];
  const visible = new Set<string>([
    Handles.statusCurrentUser,
    Handles.statusWorkOffline,
  ]);
  const node = (id: string) => ({
    isVisible: () => Promise.resolve(visible.has(id)),
    key: (key: string) => {
      did.push(`${id}:key ${key}`);
      if (key === 'commandPalette') visible.add(Handles.commandPaletteInput);
      return Promise.resolve();
    },
    clear: () => Promise.resolve(),
    input: (text: string) => {
      did.push(`${id}:input ${text}`);
      return Promise.resolve();
    },
    expect: { visible: () => Promise.resolve() },
  });
  const appBuilds = createHarnessAppBuilds();
  await appBuilds.set('alice', 'outdated');
  const s = {
    harness: { appBuilds },
    session: {
      // The real-time runtime: no modelled network to partition or heal.
      caps: new Set<string>(),
      network: {
        heal: () => {
          throw new Error("runtime lacks 'partition'");
        },
      },
      waitForIdle: () => Promise.resolve(),
    },
    runtime: {
      restartActor: (id: string) => {
        did.push(`restart ${id}`);
        return Promise.resolve();
      },
    },
    actors: new Map([['alice', { ui: { get: node } }]]),
  };
  return { s, did, appBuilds };
}

// regression: browser-update-app-heals-unmodelled-network
test('updating a live browser app reopens it on the current build and back online', async () => {
  const { s, did, appBuilds } = await offlineBrowserDevice();
  await Promise.resolve(updateApp.act(s as never, 'alice'));
  expect(appBuilds.of('alice')).toBe('current');
  expect(did).toEqual([
    'restart alice',
    `${Handles.statusCurrentUser}:key commandPalette`,
    `${Handles.commandPaletteInput}:input Work online`,
    `${Handles.commandPaletteInput}:key enter`,
  ]);
});
