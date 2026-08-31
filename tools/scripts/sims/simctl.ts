// @io-wall-ok

import { execFileSync } from 'node:child_process';
import { reconcileAction } from './reconcile-sim';
import { isProjectSimName } from './sim-project';
import type { SimSpecEntry } from './sim-spec';

export type SimDeviceRecord = {
  readonly udid: string;
  readonly name: string;
  readonly state: string;
  readonly deviceTypeIdentifier: string;
  readonly runtimeIdentifier: string;
};

type SimDeviceJson = {
  udid: string;
  name: string;
  state: string;
  deviceTypeIdentifier: string;
};

type SimRuntimeJson = {
  identifier: string;
  version: string;
  platform: string;
  isAvailable: boolean;
};

type SimDeviceTypeJson = {
  identifier: string;
  name: string;
  productFamily: string;
};

function log(message: string): void {
  process.stderr.write(`[setup:sims] ${message}\n`);
}

function captureJson<T>(cmd: string, args: string[]): T {
  const raw = execFileSync(cmd, args, { encoding: 'utf8' });
  return JSON.parse(raw) as T;
}

export function listDevices(): SimDeviceRecord[] {
  const json = captureJson<{
    devices: Record<string, SimDeviceJson[]>;
  }>('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  const rows: SimDeviceRecord[] = [];
  for (const [runtimeIdentifier, devices] of Object.entries(json.devices)) {
    for (const device of devices) {
      rows.push({
        udid: device.udid,
        name: device.name,
        state: device.state,
        deviceTypeIdentifier: device.deviceTypeIdentifier,
        runtimeIdentifier,
      });
    }
  }
  return rows;
}

export function listDeviceTypeIds(): string[] {
  const json = captureJson<{ devicetypes: SimDeviceTypeJson[] }>('xcrun', [
    'simctl',
    'list',
    'devicetypes',
    '--json',
  ]);
  return json.devicetypes.map((row) => row.identifier);
}

export function listAvailableIosRuntimeIds(): string[] {
  const json = captureJson<{ runtimes: SimRuntimeJson[] }>('xcrun', [
    'simctl',
    'list',
    'runtimes',
    'available',
    '--json',
  ]);
  return json.runtimes
    .filter((row) => row.platform === 'iOS' && row.isAvailable)
    .map((row) => row.identifier);
}

export function assertSimSpecPrerequisites(
  spec: readonly SimSpecEntry[]
): void {
  const deviceTypes = new Set(listDeviceTypeIds());
  const runtimes = new Set(listAvailableIosRuntimeIds());

  for (const entry of spec) {
    if (entry.platform !== 'ios') {
      throw new Error(
        `Unsupported platform "${entry.platform}" for sim "${entry.id}". Only "ios" is implemented.`
      );
    }
    if (!deviceTypes.has(entry.deviceType)) {
      throw new Error(
        `Device type "${entry.deviceType}" for sim "${entry.id}" is not installed.\n` +
          `Install it via Xcode → Settings → Platforms, or update SIM_SPEC.\n` +
          `Available device types:\n${[...deviceTypes].sort().join('\n')}`
      );
    }
    if (!runtimes.has(entry.runtime)) {
      throw new Error(
        `Runtime "${entry.runtime}" for sim "${entry.id}" is not available.\n` +
          `Install it via Xcode → Settings → Platforms, or update SIM_SPEC.\n` +
          `Available iOS runtimes:\n${[...runtimes].sort().join('\n')}`
      );
    }
  }
}

export function findDeviceByName(name: string): SimDeviceRecord | undefined {
  return listDevices().find((device) => device.name === name);
}

export function listProjectDevices(): SimDeviceRecord[] {
  return listDevices().filter((device) => isProjectSimName(device.name));
}

export function createDevice(
  name: string,
  deviceType: string,
  runtime: string
): string {
  return execFileSync(
    'xcrun',
    ['simctl', 'create', name, deviceType, runtime],
    { encoding: 'utf8' }
  ).trim();
}

export function shutdownDevice(udid: string): void {
  try {
    execFileSync('xcrun', ['simctl', 'shutdown', udid], { stdio: 'pipe' });
  } catch {
    // Already shut down.
  }
}

export function deleteDevice(udid: string): void {
  execFileSync('xcrun', ['simctl', 'delete', udid], { stdio: 'inherit' });
}

export function reconcileSim(entry: SimSpecEntry): SimDeviceRecord {
  const existing = findDeviceByName(entry.name);
  const action = reconcileAction(entry, existing);

  if (action === 'reuse' && existing !== undefined) {
    log(`Reusing "${entry.name}" (${existing.udid}, state=${existing.state}).`);
    return existing;
  }

  if (action === 'recreate' && existing !== undefined) {
    log(
      `Recreating "${entry.name}" — type/runtime changed (${existing.deviceTypeIdentifier} / ${existing.runtimeIdentifier}).`
    );
    if (existing.state === 'Booted') {
      shutdownDevice(existing.udid);
    }
    deleteDevice(existing.udid);
  }

  log(`Creating "${entry.name}" (${entry.deviceType} on ${entry.runtime})…`);
  const udid = createDevice(entry.name, entry.deviceType, entry.runtime);
  log(`Created "${entry.name}" (${udid}).`);
  return {
    udid,
    name: entry.name,
    state: 'Shutdown',
    deviceTypeIdentifier: entry.deviceType,
    runtimeIdentifier: entry.runtime,
  };
}
