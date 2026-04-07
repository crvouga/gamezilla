import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

export class TerraformDep implements Dep {
  readonly name = 'terraform';
  readonly bin = 'terraform';

  version(): string | null {
    return captureVersion('terraform', ['version']);
  }

  check(): DepStatus {
    if (!whichSync('terraform'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  install(): void {
    spawnInstall('brew', ['install', 'hashicorp/tap/terraform']);
  }

  upgrade(): void {
    spawnInstall('brew', ['tap', 'hashicorp/tap']);
    spawnInstall('brew', ['upgrade', 'hashicorp/tap/terraform']);
  }

  verify(): void {
    verifyRun('terraform', ['version']);
  }
}
