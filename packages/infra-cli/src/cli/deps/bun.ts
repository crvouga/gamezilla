import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

export class BunDep implements Dep {
  readonly name = 'bun';
  readonly bin = 'bun';

  version(): string | null {
    return captureVersion('bun', ['--version']);
  }

  check(): DepStatus {
    if (!whichSync('bun')) return { ok: false, reason: 'not found on PATH' };
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  install(): void {
    spawnInstall('bash', ['-c', 'curl -fsSL https://bun.sh/install | bash']);
  }

  upgrade(): void {
    spawnInstall('bun', ['upgrade']);
  }

  verify(): void {
    verifyRun('bun', ['--version']);
  }
}
