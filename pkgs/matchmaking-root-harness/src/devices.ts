import { MatchmakingDevice } from '@pkgs/matchmaking-root-shared/device';
import type { MatchmakingHarness } from './facade';

export type PersonDevice = {
  readonly person: string;
  readonly place?: string;
  readonly replicaId?: string;
};

export function deviceAt(
  s: MatchmakingHarness,
  device: PersonDevice
): MatchmakingDevice {
  if (device.replicaId !== undefined) s.deviceReplicaId = device.replicaId;
  const key = JSON.stringify([device.person, device.place ?? 'phone']);
  const existing = s.devices.get(key);
  if (existing !== undefined) return existing;
  const client = new MatchmakingDevice(device.person, {
    matchmaking: () =>
      s.deviceReplicaId === undefined ? s.mm : s.replica(s.deviceReplicaId).mm,
  });
  s.devices.set(key, client);
  return client;
}

export async function refreshDevices(s: MatchmakingHarness): Promise<void> {
  await Promise.all([...s.devices.values()].map((device) => device.refresh()));
}

export function deviceView(s: MatchmakingHarness, device: PersonDevice) {
  return deviceAt(s, device).view();
}

export function deviceRange(
  s: MatchmakingHarness,
  device: PersonDevice
): number {
  return deviceAt(s, device).range();
}

export function deviceConnected(
  s: MatchmakingHarness,
  device: PersonDevice
): boolean {
  return deviceAt(s, device).connected();
}
