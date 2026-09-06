/**
 * In-memory device / platform ports shared by every simulated `ClientEnv`
 * (`@product/sim` fabric and the shell test env). One builder so a new port
 * on `ClientEnv` is wired in exactly one place for sims.
 */

import type { DevMenuItem, DevMenuPort } from '@apps/client/device/ports';
import { createRecordingClipboard } from '@pkgs/device/clipboard';
import { createInMemoryNetworkStatePort } from '@pkgs/device/network-state';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds/audio-playback/in-memory-audio-playback-port';

import type { ClientEnv } from './client-env';

export type InMemoryClientPorts = Pick<
  ClientEnv,
  | 'network'
  | 'clipboard'
  | 'audio'
  | 'devMenu'
  | 'objectStore'
  | 'observability'
>;

/** Recording {@link DevMenuPort}: keeps every registered item for the sim. */
function createInMemoryDevMenuPort(): DevMenuPort {
  const items: DevMenuItem[] = [];
  return {
    registerItems: async (registered) => {
      items.splice(0, items.length, ...registered);
    },
  };
}

/** `label` names the observability scope (`sim-client:alice`). */
export function createInMemoryClientPorts(label: string): InMemoryClientPorts {
  return {
    network: createInMemoryNetworkStatePort(),
    clipboard: createRecordingClipboard(),
    audio: createInMemoryAudioPlaybackPort(),
    devMenu: createInMemoryDevMenuPort(),
    objectStore: new ObjectStoreImplInMemory(),
    observability: createNoopObservability(label),
  };
}
