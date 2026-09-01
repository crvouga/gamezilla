#!/usr/bin/env bun

// @io-wall-ok
/**
 * Provision project iOS simulators for local Expo development:
 * - create/reconcile SIM_SPEC devices (gamezilla-prefixed iPhone + iPad)
 * - install Expo Go on every device (`bun run dev` → console on iPad)
 * - install the product expo-dev-client on the iPhone (`bun run client:ios`)
 */

import {
  ensureDevClientInstalled,
  resolveDedicatedSim,
} from '../../../apps/client/scripts/ios-dedicated-sim';
import { ensureExpoGoInstalled, resolveExpoSdkVersion } from './expo-go';
import { bootSimIfNeeded, resolveProjectSim } from './sim-runtime';
import { SIM_SPEC } from './sim-spec';
import { assertSimSpecPrerequisites, reconcileSim } from './simctl';

const LOG_PREFIX = '[sims:setup]';

function log(message: string): void {
  process.stderr.write(`${LOG_PREFIX} ${message}\n`);
}

async function installExpoGoOnAllSims(sdkVersion: string): Promise<void> {
  log(`Ensuring Expo Go (SDK ${sdkVersion}) on project simulators…`);
  for (const entry of SIM_SPEC) {
    const { udid, name } = resolveProjectSim(entry.id);
    bootSimIfNeeded(udid, name, log);
    await ensureExpoGoInstalled(udid, sdkVersion, log);
    log(`Expo Go ready on "${name}".`);
  }
}

function installProductDevClient(): void {
  log('Ensuring product development build on iPhone…');
  const { udid, name } = resolveDedicatedSim();
  bootSimIfNeeded(udid, name, log);
  ensureDevClientInstalled(udid, name);
  log(`Product client ready on "${name}".`);
}

function printNextSteps(): void {
  log('Next steps:');
  log('  bun run sims:open     — boot Simulator.app for chosen devices');
  log(
    '  bun run dev           — @sim/console; press i / Shift+I for iPad Expo Go'
  );
  log(
    '  bun run client:ios    — product app on the project iPhone (dev client)'
  );
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    process.stderr.write(
      `${LOG_PREFIX} iOS Simulator setup requires macOS with Xcode.\n`
    );
    process.exit(1);
  }

  assertSimSpecPrerequisites(SIM_SPEC);

  for (const entry of SIM_SPEC) {
    reconcileSim(entry);
  }

  const sdkVersion = resolveExpoSdkVersion();
  await installExpoGoOnAllSims(sdkVersion);
  installProductDevClient();

  log('Done.');
  printNextSteps();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  process.exit(1);
});
