import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

export class WranglerDep implements Dep {
  readonly name = 'wrangler';
  readonly bin = 'wrangler';

  version(): string | null {
    return captureVersion('wrangler', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('wrangler'))
      return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  install(): void {
    spawnInstall('bun', ['add', '-g', 'wrangler']);
  }

  upgrade(): void {
    spawnInstall('bun', ['add', '-g', 'wrangler@latest']);
  }

  verify(): void {
    verifyRun('wrangler', ['whoami']);
  }
}
