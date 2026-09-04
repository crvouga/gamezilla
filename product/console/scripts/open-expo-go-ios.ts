// @io-wall-ok

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureExpoGoInstalled,
  resolveExpoSdkVersion,
} from '../../../tools/scripts/sims/expo-go';
import { SIM_PROJECT_SLUG } from '../../../tools/scripts/sims/sim-project';
import {
  bootSimIfNeeded,
  openSimulatorApp,
  openUrlOnSim,
  resolveProjectSim,
} from '../../../tools/scripts/sims/sim-runtime';
import type { SimSpecId } from '../../../tools/scripts/sims/sim-spec';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const consoleRoot = join(scriptDir, '..');

function log(message: string): void {
  process.stderr.write(`[expo-go-ios] ${message}\n`);
}

export async function openExpoGoOnProjectSim(
  simId: SimSpecId,
  metroPort: number
): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Expo Go on iOS Simulator requires macOS.');
  }

  const { udid, name } = resolveProjectSim(simId);
  bootSimIfNeeded(udid, name, log);
  openSimulatorApp();

  const sdkVersion = resolveExpoSdkVersion(consoleRoot);
  await ensureExpoGoInstalled(udid, sdkVersion, log);

  const metroUrl = `exp://127.0.0.1:${String(metroPort)}`;
  openUrlOnSim(udid, metroUrl);
  log(
    `Opened ${metroUrl} on "${name}" (${SIM_PROJECT_SLUG} ${simId}, ${udid}).`
  );
}
