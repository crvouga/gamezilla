import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

export class DopplerDep implements Dep {
  readonly name = 'doppler';
  readonly bin = 'doppler';

  version(): string | null {
    return captureVersion('doppler', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('doppler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  install(): void {
    spawnInstall('brew', ['install', 'dopplerhq/cli/doppler']);
  }

  upgrade(): void {
    spawnInstall('brew', ['upgrade', 'dopplerhq/cli/doppler']);
  }

  verify(): void {
    verifyRun('doppler', ['--version']);
  }
}
