/**
 * The world a `specs/sync-engine/` scenario runs in: one `exampleSystem` run, with
 * each person's devices added the first time a step names them. A device in
 * a shared-space scenario hydrates the person's space memberships; any other
 * hydrates every note.
 */

import { setWorld, stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { SPACE_MEMBERSHIP_SESSION } from '@pkgs/sync-engine-harness-ts/membership-query';
import type { goesBack } from '@pkgs/sync-engine-harness-ts/reads';
import { addClient } from '@pkgs/sync-engine-harness-ts/regression-actions';
import type { SyncHarness } from '@pkgs/sync-engine-harness-ts/scenario-system';

export type Device = { readonly actor: string; readonly kind: string };

export type SyncWorld = {
  readonly s: Run<SyncHarness>;
  /** Devices already added (harness client ids). */
  readonly devices: Set<string>;
  /** The shared space each person is in, by actor. */
  readonly spaceOf: Map<string, string>;
  /** Who started each shared space (the one who can end it), by space. */
  readonly hostOf: Map<string, string>;
  /** How long each note took to reach a person, in order, by actor. */
  readonly arrivalsMs: Map<string, number[]>;
  /** Devices currently offline. */
  readonly offline: OfflineDevices;
  /** One observation history spanning both writing and subsequent delivery. */
  noteWatch: ReturnType<typeof goesBack> | null;
};

/** Offline devices, by client id. */
export class OfflineDevices {
  private readonly ids = new Set<string>();
  has(device: Device): boolean {
    return this.ids.has(clientId(device));
  }
  set(device: Device, isOffline: boolean): void {
    if (isOffline) this.ids.add(clientId(device));
    else this.ids.delete(clientId(device));
  }
}

export const { Given, When, Then } = stepsFor<SyncWorld>();

/** `Alice's app` is client `alice`; `Alice's phone` is `alice-phone`. */
export function clientId(device: Device): string {
  return device.kind === 'app'
    ? device.actor
    : `${device.actor}-${device.kind}`;
}

export const app = (actor: string): Device => ({ actor, kind: 'app' });

/** The device's harness client, added on first use. */
export async function ensureDevice(
  w: SyncWorld,
  device: Device,
  scopedToSpaces = false
): Promise<string> {
  const id = clientId(device);
  if (!w.devices.has(id)) {
    w.devices.add(id);
    await w.s.apply(addClient, {
      id,
      actorId: device.actor,
      ...(scopedToSpaces ? { sessionQuery: SPACE_MEMBERSHIP_SESSION } : {}),
    });
  }
  return id;
}

export function useSyncWorld(): void {
  setWorld<SyncWorld>({
    create: async () => ({
      s: await exampleSystem.run({ seed: 1, args: { clientCount: 0 } }),
      devices: new Set(),
      spaceOf: new Map(),
      hostOf: new Map(),
      arrivalsMs: new Map(),
      offline: new OfflineDevices(),
      noteWatch: null,
    }),
    dispose: (w) => w.s[Symbol.asyncDispose](),
    record: (w, step, fn) =>
      w.s.record(
        {
          kind: step.keyword.trim(),
          title: `${step.keyword.trim()} ${step.text}`,
        },
        fn
      ),
  });
}
