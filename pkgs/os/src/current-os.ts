import { LinuxOs } from './linux-os';
import { MacOs } from './mac-os';
import type { Os } from './os';
import { currentArch, currentPlatform } from './platform';
import { WindowsOs } from './windows-os';

let cached: Os | null = null;

/** Memoized current OS detector. */
export function currentOs(): Os {
  if (cached !== null) return cached;
  const platform = currentPlatform();
  const arch = currentArch();
  if (platform === 'darwin') cached = new MacOs(arch);
  else if (platform === 'linux') cached = new LinuxOs(arch);
  else cached = new WindowsOs(arch);
  return cached;
}

/** Test-only: reset the memoized OS so a different platform can be injected. */
export function _resetCurrentOsForTesting(): void {
  cached = null;
}
