/**
 * In-memory device / platform ports shared by every simulated `ClientEnv`
 * (`@apps/product/harness` fabric and the shell test env). One builder so a new port
 * on `ClientEnv` is wired in exactly one place for harnesses.
 */

import type { DevMenuItem, DevMenuPort } from '@libs/client-app/device/ports';
import { createRecordingClipboard } from '@pkgs/device/clipboard';
import { createRecordingHaptics } from '@pkgs/device/haptics';
import { createMotionPreference } from '@pkgs/device/motion-preference';
import { createInMemoryNetworkStatePort } from '@pkgs/device/network-state';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';

import type { ClientEnv } from './client-env';

export type InMemoryClientPorts = Pick<
  ClientEnv,
  | 'network'
  | 'clipboard'
  | 'haptics'
  | 'audio'
  | 'motion'
  | 'devMenu'
  | 'objectStore'
>;

/** Recording {@link DevMenuPort}: keeps every registered item for the harness. */
function createInMemoryDevMenuPort(): DevMenuPort {
  const items: DevMenuItem[] = [];
  return {
    registerItems: (registered) => {
      items.splice(0, items.length, ...registered);
      return Promise.resolve();
    },
  };
}

export function createInMemoryClientPorts(): InMemoryClientPorts {
  return {
    motion: createMotionPreference(),
    network: createInMemoryNetworkStatePort(),
    clipboard: createRecordingClipboard(),
    haptics: createRecordingHaptics(),
    audio: createInMemoryAudioPlaybackPort(),
    devMenu: createInMemoryDevMenuPort(),
    objectStore: new ObjectStoreImplInMemory(),
  };
}
