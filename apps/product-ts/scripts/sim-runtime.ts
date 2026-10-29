// @io-wall-ok

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { registerDevSimulator } from '@pkgs/dev-owner-server-ts/dev-owner-resources';
import type { SimSpecId } from './sim-spec';
import { simSpecById } from './sim-spec';
import {
  findDeviceByName,
  isSimDataPresent,
  listDevices,
  reconcileSim,
} from './simctl';

export function resolveProjectSim(id: SimSpecId): {
  udid: string;
  name: string;
} {
  const spec = simSpecById(id);
  const existing = findDeviceByName(spec.name);
  if (existing === undefined) {
    throw new Error(
      `Simulator "${spec.name}" is missing. Run \`bun run sims:setup\` first.`
    );
  }
  if (!isSimDataPresent(existing.udid)) {
    const healed = reconcileSim(spec);
    return { udid: healed.udid, name: spec.name };
  }
  return { udid: existing.udid, name: spec.name };
}

export function bootSimIfNeeded(
  udid: string,
  simName: string,
  log: (message: string) => void
): void {
  const dev = listDevices().find((d) => d.udid === udid);
  if (dev?.state === 'Booted') {
    log(`Simulator "${simName}" already booted.`);
    return;
  }
  if (!isSimDataPresent(udid)) {
    throw new Error(
      `Simulator "${simName}" data is missing on disk. Run \`bun run sims:setup\` to recreate it.`
    );
  }
  registerDevSimulator(
    realpathSync(join(import.meta.dirname, '../../..')),
    udid
  );
  log(`Booting simulator "${simName}"…`);
  try {
    execFileSync('xcrun', ['simctl', 'boot', udid], { stdio: 'inherit' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Booted/i.test(msg)) throw err;
  }
}

export function openSimulatorApp(): void {
  try {
    execFileSync('open', ['-a', 'Simulator'], { stdio: 'inherit' });
  } catch {
    // Non-fatal — Simulator.app may already be running.
  }
}

export function openUrlOnSim(udid: string, url: string): void {
  execFileSync('xcrun', ['simctl', 'openurl', udid, url], {
    stdio: 'inherit',
  });
}

export function isAppInstalled(udid: string, bundleId: string): boolean {
  try {
    execFileSync('xcrun', ['simctl', 'get_app_container', udid, bundleId], {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}
